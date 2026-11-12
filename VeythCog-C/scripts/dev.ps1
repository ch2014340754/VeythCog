<#
.SYNOPSIS
    VeythCog 本地开发一键启动：后端 vc-app（:8123）+ 前端 VeythCog-V（:3000）。

.DESCRIPTION
    两条硬规则，都是为了不再踩同一个坑：

    1) 启动前先释放端口。上一个后端/前端进程没关干净时直接报错会让人一脸问号，
       这里改成「先停掉占端口的进程，确认端口真空了再启动」，并在日志里写清杀了谁。

    2) 后端必须「mvn 打包成功才启动」。IDE（Trae / VS Code 的 Java 扩展）跑
       com.vc.app.VcAppApplication 时 classpath 直接指着各模块 target/classes，
       增量编译没跑成 / 编译失败时照样启动并加载上一版旧 class，
       症状是「代码改了不生效」（新增接口 404、/nav/wallpaper/thumb 已 permitAll 仍 401），
       而 IDE 控制台一声不响。本脚本打包失败就中止，绝不跑旧 class。

.PARAMETER Target
    all       后端 + 前端（默认）。后端在后台起（日志落到 vc-app/target/dev-logs/backend.log），
              前端留在当前窗口，Ctrl+C 关前端时会顺手把后端也停掉。
    backend   只起后端，前台运行（日志直接在窗口里）。
    frontend  只起前端，前台运行。
    stop      只停进程：释放 8123 与 3000，不启动任何东西。

.PARAMETER SkipBuild
    跳过 maven 打包，直接用现有 jar（纯重启，秒级）。

.PARAMETER Online
    联网构建。默认离线构建（用本机 maven 本地仓库）；新增依赖后第一次要加这个。

.PARAMETER BackendPort
    后端端口，默认 8123。

.PARAMETER JdkHome
    手动指定 JDK 目录（优先级最高）。不写就不用改脚本：脚本自己从项目配置读版本再找。

.PARAMETER JavaVersion
    覆盖项目声明的 JDK 版本（一般不用）。默认读 VeythCog-C\pom.xml 的 <java.version>。

    关于 JDK 怎么挑（不再写死路径）：
      1) 版本 = pom.xml 的 <java.version>（本项目 21），miss 才退回 maven.compiler.release/source/target；
      2) JDK 来源依次为：-JdkHome → scripts\jdk.path（可选，填一个目录即可给换机器用）
         → VEYTH_JAVA_HOME → .vscode\settings.json 的 java.jdt.ls.java.home / java.configuration.runtimes
         → JAVA_HOME → 注册表 JavaSoft → 常见安装目录扫描（含 %USERPROFILE%\.jdks、
         Trae/IDEA 自带 jbr）→ PATH 上的 java；
      3) 优先版本完全一致的那套；没有就用版本最近的更高版本并提示；只有更低版本时直接报错
         并列出扫到的 JDK。选定后回写 $env:JAVA_HOME，保证 mvn 与 java 用同一套。

.PARAMETER FrontendPort
    前端端口，默认 3000。

.EXAMPLE
    pwsh VeythCog-C\scripts\dev.ps1
.EXAMPLE
    pwsh VeythCog-C\scripts\dev.ps1 backend -SkipBuild
.EXAMPLE
    pwsh VeythCog-C\scripts\dev.ps1 stop
#>
param(
    [ValidateSet('all', 'backend', 'frontend', 'stop')]
    [string]$Target = 'all',
    [switch]$SkipBuild,
    [switch]$Online,
    [int]$BackendPort = 8123,
    [int]$FrontendPort = 3000,
    [string]$JdkHome = '',
    [int]$JavaVersion = 0
)

$ErrorActionPreference = 'Stop'

# ---- 路径：scripts 目录 → VeythCog-C → 仓库根 ----
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ProjectRoot = Split-Path -Parent $RepoRoot
$FrontDir = Join-Path $ProjectRoot 'VeythCog-V'
$LogDir = Join-Path $RepoRoot 'vc-app\target\dev-logs'

function Write-Step($msg) { Write-Host "[dev] $msg" -ForegroundColor Cyan }
function Write-Note($msg) { Write-Host "[dev] $msg" -ForegroundColor Yellow }
function Fail($msg) {
    Write-Host "[dev] 中止：$msg" -ForegroundColor Red
    exit 1
}

# ---------- 端口工具 ----------
function Get-PortOwner([int]$Port) {
    $c = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return [int]$c.OwningProcess }
    return 0
}

function Release-Port([int]$Port, [string]$Label) {
    $owner = Get-PortOwner $Port
    if ($owner -le 0) { Write-Step "$Label $Port 空闲"; return }
    $name = '未知进程'
    try { $name = (Get-Process -Id $owner -ErrorAction Stop).ProcessName } catch { }
    Write-Note "$Label $Port 被 PID=$owner ($name) 占用 → 先停掉它"
    try { Stop-Process -Id $owner -Force -ErrorAction Stop }
    catch { Fail "停不掉 PID=$owner（$($_.Exception.Message)），请手动结束后重试" }

    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 300
        if ((Get-PortOwner $Port) -le 0) { Write-Step "$Label $Port 已释放"; return }
    }
    Fail "$Label $Port 15 秒内没有释放，可能有子进程还占着；用 Get-NetTCPConnection -LocalPort $Port 查一下"
}

# ---------- 工具链 ----------
function ConvertTo-JavaMajor($ver) {
    # 1.8.0_202 记作 8；21.0.12.1 记作 21
    if ($ver -match '^1\.([0-9]+)') { return [int]$Matches[1] }
    $m = [regex]::Match($ver, '([0-9]+)')
    if ($m.Success) { return [int]$m.Groups[1].Value }
    return 0
}

function Get-JdkMajorFromRelease($jdkHome) {
    $f = Join-Path $jdkHome 'release'
    if (-not (Test-Path -LiteralPath $f)) { return 0 }
    try {
        $txt = Get-Content -LiteralPath $f -Raw -ErrorAction Stop
        $m = [regex]::Match($txt, 'JAVA_VERSION="([0-9._]+)"')
        if ($m.Success) { return (ConvertTo-JavaMajor $m.Groups[1].Value) }
    } catch { }
    return 0
}

function Get-JavaMajor($javaExe) {
    # 优先读 JDK 自带的 release 文件，不拉起子进程：Windows PowerShell 5.1 在
    # $ErrorActionPreference='Stop' 时，`java -version 2>&1` 抛 NativeCommandError 会让探测恒为 0
    $jdkDir = Split-Path -Parent (Split-Path -Parent $javaExe)
    $major = Get-JdkMajorFromRelease $jdkDir
    if ($major -gt 0) { return $major }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = (& $javaExe -version 2>&1 | Out-String)
        $m = [regex]::Match($out, 'version "([0-9._]+)')
        if ($m.Success) { return (ConvertTo-JavaMajor $m.Groups[1].Value) }
    } catch { } finally { $ErrorActionPreference = $prev }
    return 0
}

# 项目声明的 JDK 版本：根 pom 的 <java.version> 是唯一权威来源（本项目 21）
function Get-ProjectJavaVersion {
    $pom = Join-Path $RepoRoot 'pom.xml'
    if (-not (Test-Path -LiteralPath $pom)) { Fail "找不到 $pom，无法读取项目声明的 JDK 版本" }
    $xml = Get-Content -LiteralPath $pom -Raw
    foreach ($key in @('java.version', 'maven.compiler.release', 'maven.compiler.target', 'maven.compiler.source')) {
        $m = [regex]::Match($xml, '<' + [regex]::Escape($key) + '>\s*([0-9]+(?:\.[0-9]+)*)')
        if (-not $m.Success) { continue }
        $raw = $m.Groups[1].Value
        $major = 0
        if ($raw -match '^1\.([0-9]+)') { $major = [int]$Matches[1] }   # 1.8 这种老写法
        else { $major = [int](($raw -split '\.')[0]) }
        if ($major -gt 0) {
            return [pscustomobject]@{ Major = $major; Raw = $raw; Source = "pom.xml <$key>" }
        }
    }
    Fail 'pom.xml 里没有 java.version / maven.compiler.* 配置，无法确定需要的 JDK 版本'
}

function Read-JdkPinFile {
    $pin = Join-Path $PSScriptRoot 'jdk.path'
    if (-not (Test-Path -LiteralPath $pin)) { return '' }
    $line = Get-Content -LiteralPath $pin -Encoding UTF8 -ErrorAction SilentlyContinue |
            Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') } |
            Select-Object -First 1
    if ($line) { return $line.Trim() }
    return ''
}

# 收集机器上所有可用的 JDK，按「越像用户指定的越靠前」排序；不写死任何路径
function Get-JdkCandidates {
    $pairs = New-Object System.Collections.ArrayList

    if ($JdkHome) { [void]$pairs.Add(@($JdkHome, '参数 -JdkHome')) }
    $pin = Read-JdkPinFile
    if ($pin) { [void]$pairs.Add(@($pin, 'scripts\jdk.path')) }
    if ($env:VEYTH_JAVA_HOME) { [void]$pairs.Add(@($env:VEYTH_JAVA_HOME, 'VEYTH_JAVA_HOME')) }
    if ($env:JAVA_HOME) { [void]$pairs.Add(@($env:JAVA_HOME, 'JAVA_HOME')) }

    # IDE 里配的 JDK（Trae / VS Code 的 Java 扩展）
    $vscodeSettings = Join-Path $ProjectRoot '.vscode\settings.json'
    if (Test-Path -LiteralPath $vscodeSettings) {
        $sj = Get-Content -LiteralPath $vscodeSettings -Raw
        foreach ($m in [regex]::Matches($sj, '"java\.jdt\.ls\.java\.home"\s*:\s*"([^"]+)"')) {
            [void]$pairs.Add(@($m.Groups[1].Value, '.vscode\settings.json'))
        }
        foreach ($m in [regex]::Matches($sj, '"java\.configuration\.runtimes"[\s\S]*?\}')) {
            foreach ($mm in [regex]::Matches($m.Value, '"path"\s*:\s*"([^"]+)"')) {
                [void]$pairs.Add(@($mm.Groups[1].Value, '.vscode\settings.json runtimes'))
            }
        }
    }
    $ideaMisc = Join-Path $RepoRoot '.idea\misc.xml'
    if (Test-Path -LiteralPath $ideaMisc) {
        foreach ($m in [regex]::Matches((Get-Content -LiteralPath $ideaMisc -Raw), 'project-jdk-name="([^"]+)"')) {
            $name = $m.Groups[1].Value
            if ($name -match '^[A-Za-z]:\\' -or $name -match '^[A-Za-z]:/') { [void]$pairs.Add(@($name, '.idea\misc.xml')) }
        }
    }

    # 安装时登记到注册表的 JDK
    foreach ($key in @('HKLM:\SOFTWARE\JavaSoft\JDK',
                       'HKLM:\SOFTWARE\JavaSoft\Java Development Kit',
                       'HKLM:\SOFTWARE\WOW6432Node\JavaSoft\JDK',
                       'HKLM:\SOFTWARE\WOW6432Node\JavaSoft\Java Development Kit')) {
        if (-not (Test-Path -LiteralPath $key)) { continue }
        Get-ChildItem -LiteralPath $key -ErrorAction SilentlyContinue | ForEach-Object {
            $h = $_.GetValue('JavaHome')
            if ($h) { [void]$pairs.Add(@($h, '注册表 JavaSoft')) }
        }
    }

    # 常见安装目录 + IDE 自己下载的 JDK（.jdks / jbr）里扫
    $roots = @(
        'D:\Java', 'E:\Java', 'I:\Java', 'C:\Java',
        'C:\Program Files\Java', 'C:\Program Files\Eclipse Adoptium',
        'C:\Program Files\Microsoft', 'C:\Program Files\Zulu',
        'C:\Program Files\Amazon Corretto', 'C:\Program Files\BellSoft',
        'C:\Program Files\Semeru', 'C:\Program Files\JetBrains',
        (Join-Path $env:USERPROFILE '.jdks'),
        (Join-Path $env:USERPROFILE 'scoop\apps'),
        (Join-Path $env:LOCALAPPDATA 'Programs'),
        (Join-Path $env:LOCALAPPDATA 'JetBrains\Toolbox\apps')
    )
    foreach ($r in $roots) {
        if (-not $r -or -not (Test-Path -LiteralPath $r)) { continue }
        $dirs = Get-ChildItem -LiteralPath $r -Directory -Recurse -Depth 2 -ErrorAction SilentlyContinue
        foreach ($d in $dirs) {
            if (Test-Path -LiteralPath (Join-Path $d.FullName 'bin\java.exe')) {
                [void]$pairs.Add(@($d.FullName, "扫描 $r"))
            }
        }
    }

    # PATH 上的 java 反推 home
    foreach ($cmd in (Get-Command java.exe -All -ErrorAction SilentlyContinue)) {
        if ($cmd.Source) { [void]$pairs.Add(@((Split-Path -Parent (Split-Path -Parent $cmd.Source)), 'PATH')) }
    }

    # 只保留真的含 bin\java.exe 的目录，同路径去重（先出现的来源优先）
    $list = New-Object System.Collections.ArrayList
    foreach ($p in $pairs) {
        $path = $p[0]
        if (-not $path) { continue }
        $h = ([string]$path).Trim().Trim([char]'"')
        if (-not $h) { continue }
        $exe = Join-Path $h 'bin\java.exe'
        # javac 也在才算 JDK（排除 jre1.8 这类纯运行时目录，mvn 编译要用 javac）
        if (-not (Test-Path -LiteralPath $exe)) { continue }
        if (-not (Test-Path -LiteralPath (Join-Path $h 'bin\javac.exe'))) { continue }
        $full = (Resolve-Path -LiteralPath $h).Path
        $dup = $false
        foreach ($x in $list) { if ($x.Home -ieq $full) { $dup = $true; break } }
        if ($dup) { continue }
        [void]$list.Add([pscustomobject]@{ Home = $full; From = [string]$p[1]; Major = (Get-JavaMajor $exe) })
    }
    return $list
}

function Format-JdkList($cands) {
    $lines = @()
    foreach ($c in $cands) {
        if ($c.Major -gt 0) { $lines += ("    Java {0,-3} {1}   [{2}]" -f $c.Major, $c.Home, $c.From) }
        else { $lines += ("    未知版本  {0}   [{1}]" -f $c.Home, $c.From) }
    }
    return ($lines -join [Environment]::NewLine)
}

# 按项目声明的版本挑 JDK：版本完全一致优先 → 否则最近的更高版本 → 都不够就报错
function Resolve-Jdk([int]$RequiredMajor) {
    $cands = Get-JdkCandidates
    if ($cands.Count -eq 0) {
        Fail "这台机器上一个 JDK 都没扫到（含 bin\javac.exe 的目录）。装一个 Java $RequiredMajor，或用 -JdkHome 指定，或在 scripts\jdk.path 里写目录。"
    }

    $exact = @($cands | Where-Object { $_.Major -eq $RequiredMajor })
    if ($exact.Count -gt 0) { return $exact[0] }

    $higher = @($cands | Where-Object { $_.Major -gt $RequiredMajor } | Sort-Object Major)
    if ($higher.Count -gt 0) {
        $pick = $higher[0]
        Write-Note "没找到 Java $RequiredMajor 的 JDK，改用最近的更高版本 Java $($pick.Major)：$($pick.Home) [$($pick.From)]"
        Write-Note 'maven 已按 <release> 编译，class 版本不会跑高；若后续换回低版本 JDK，记得 mvn clean 重编'
        return $pick
    }

    Fail ("机器上的 JDK 都低于项目要求的 Java {0}：{1}{2}{1}装一个 Java {0}，或用 -JdkHome 指定，或在 scripts\jdk.path 里写目录。" -f `
            $RequiredMajor, [Environment]::NewLine, (Format-JdkList $cands))
}

$JdkMajorMap = @{ 45 = 1; 46 = 2; 47 = 3; 48 = 4; 49 = 5; 50 = 6; 51 = 7; 52 = 8; 53 = 9 }

# 校验编译产物与运行 JDK 是否同一代：避免「21 编的 class 拿 17 跑」（UnsupportedClassVersionError）
function Assert-ClassVersion($java) {
    $cls = Join-Path $RepoRoot 'vc-app\target\classes\com\vc\app\VcAppApplication.class'
    if (-not (Test-Path -LiteralPath $cls)) { return }
    $b = [IO.File]::ReadAllBytes($cls)
    if ($b.Length -lt 8) { return }
    $classMajor = ([int]$b[6] -shl 8) + [int]$b[7]
    $javaMajor = Get-JavaMajor $java
    if ($classMajor -gt ($javaMajor + 44)) {
        $classJava = $classMajor - 44
        Fail "编译产物是 Java $classJava（class major=$classMajor），当前 JDK 只有 Java $javaMajor。请 mvn clean 后用同一个 JDK 重编。"
    }
}

function Get-MvnPath {
    foreach ($c in @($env:VEYTH_MVN,
            'I:\apache-maven-3.9.6-bin\apache-maven-3.9.6\bin\mvn.cmd',
            'D:\apache-maven-3.9.6-bin\apache-maven-3.9.6\bin\mvn.cmd')) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }
    $cmd = Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    Fail '找不到 mvn.cmd，请设置环境变量 VEYTH_MVN'
}

function Get-JdkAndJava([int]$RequiredMajor) {
    $pick = Resolve-Jdk $RequiredMajor
    $jdk = $pick.Home
    $java = Join-Path $jdk 'bin\java.exe'
    Write-Step "JDK  = $jdk (Java $($pick.Major)，来源：$($pick.From))"
    if ($env:JAVA_HOME -ne $jdk) {
        $old = $env:JAVA_HOME
        $oldMajor = 0
        if ($old -and (Test-Path -LiteralPath (Join-Path $old 'bin\java.exe'))) {
            $oldMajor = Get-JavaMajor (Join-Path $old 'bin\java.exe')
        }
        $desc = '未设置'
        if ($old) { $desc = "$old (Java $oldMajor)" }
        Write-Note "JAVA_HOME = $desc 不可用于本项目，已切到 $jdk"
        $env:JAVA_HOME = $jdk
    }
    return $java
}

function Get-NpmPath {
    foreach ($c in @('I:\nodejs\npm.cmd', 'D:\nodejs\npm.cmd')) {
        if (Test-Path -LiteralPath $c) { return $c }
    }
    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    Fail '找不到 npm.cmd，请装 Node.js 或把 npm 加进 PATH'
}

# ---------- 后端 ----------
function Invoke-BackendBuild($mvn) {
    if ($SkipBuild) { Write-Step '跳过编译（-SkipBuild），直接用现有 jar'; return }
    $mvnArgs = @('-pl', 'vc-app', '-am', '-DskipTests')
    if (-not $Online) { $mvnArgs = @('-o') + $mvnArgs }
    Write-Step ('打包中：mvn ' + ($mvnArgs -join ' ') + ' package（首次约 1 分钟）')
    Push-Location $RepoRoot
    try { & $mvn @mvnArgs package } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) {
        Fail "maven 打包失败（exit=$LASTEXITCODE）。不会启动，避免把上一版旧 class 跑起来。"
    }
}

function Resolve-Jar {
    $jar = Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'vc-app\target') -Filter 'vc-app-*.jar' -File -ErrorAction SilentlyContinue |
           Where-Object { $_.Name -notlike '*.original' } |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $jar) { Fail '没找到 vc-app\target\vc-app-*.jar，去掉 -SkipBuild 完整构建一次' }

    # 只看各模块 src\main 下的源码/配置（-Include 在 PowerShell 5.1 配 -LiteralPath 时会被忽略，所以手动过滤）
    $newest = Get-ChildItem -LiteralPath $RepoRoot -Recurse -File -ErrorAction SilentlyContinue |
              Where-Object {
                  $_.FullName -match '\\src\\main\\' -and
                  $_.FullName -notmatch '\\(target|\.git|node_modules)\\' -and
                  $_.Extension -in @('.java', '.yml', '.yaml', '.xml', '.properties')
              } |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Write-Step ('jar  = ' + $jar.Name + '  (' + $jar.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss') + ')')
    if ($newest) {
        $rel = $newest.FullName.Substring($RepoRoot.Length + 1)
        Write-Step ('源码最新 = ' + $rel + '  (' + $newest.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss') + ')')
        if ($newest.LastWriteTime -gt $jar.LastWriteTime) {
            Write-Note 'jar 早于最新源码，可能有改动没进构建（本次按 jar 内容启动）'
        }
    }
    return $jar
}

function Get-JavaArgs($jar) {
    return @('-Dfile.encoding=UTF-8', '-jar', $jar.FullName, "--server.port=$BackendPort")
}

function Start-BackendDetached($java, $javaArgs) {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    $outLog = Join-Path $LogDir 'backend.log'
    $errLog = Join-Path $LogDir 'backend.err.log'
    $proc = Start-Process -FilePath $java -ArgumentList $javaArgs -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    $proc.Id | Set-Content -LiteralPath (Join-Path $LogDir 'backend.pid') -Encoding ascii

    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if ((Get-PortOwner $BackendPort) -gt 0) {
            Write-Step "后端已就绪：http://localhost:$BackendPort/api （PID=$($proc.Id)）"
            Write-Step "后端日志：$outLog"
            return $proc
        }
        if ($proc.HasExited) {
            Write-Host (Get-Content -LiteralPath $outLog -Tail 30 -ErrorAction SilentlyContinue)
            Fail "后端进程启动后立即退出，见上面的日志尾部（完整日志：$outLog）"
        }
    }
    Fail "后端 90 秒内没监听 $BackendPort，看日志：$outLog"
}

# ---------- 前端 ----------
function Invoke-Frontend($npm) {
    if (-not (Test-Path -LiteralPath $FrontDir)) { Fail "找不到前端目录：$FrontDir" }
    if (-not (Test-Path -LiteralPath (Join-Path $FrontDir 'node_modules'))) {
        Write-Note 'node_modules 缺失，先执行 npm install'
        Push-Location $FrontDir
        try { & $npm install } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { Fail 'npm install 失败' }
    }
    Write-Step "前端启动：http://localhost:$FrontendPort （Vite，Ctrl+C 停止）"
    Push-Location $FrontDir
    try {
        & $npm run dev -- --port $FrontendPort --strictPort
    } finally {
        Pop-Location
    }
}

# ======================= 主流程 =======================
if ($Target -eq 'stop') {
    Release-Port $BackendPort '后端'
    Release-Port $FrontendPort '前端'
    Write-Step "已停止（$BackendPort / $FrontendPort 都清空）"
    exit 0
}

$mvn = $null
$java = $null
if ($Target -eq 'all' -or $Target -eq 'backend') {
    $declared = Get-ProjectJavaVersion
    $requiredMajor = $declared.Major
    if ($JavaVersion -gt 0) {
        $requiredMajor = $JavaVersion
        Write-Step "项目 JDK  = Java $requiredMajor（-JavaVersion 覆盖，忽略 $($declared.Source) 的 $($declared.Raw)）"
    } else {
        Write-Step "项目 JDK  = Java $requiredMajor（来自 $($declared.Source)）"
    }
    $mvn = Get-MvnPath
    $java = Get-JdkAndJava $requiredMajor
    Write-Step "mvn  = $mvn"
    Write-Step "java = $java (Java $(Get-JavaMajor $java))"
    Write-Step "JAVA_HOME = $env:JAVA_HOME"
}
$npm = $null
if ($Target -eq 'all' -or $Target -eq 'frontend') {
    $npm = Get-NpmPath
    Write-Step "npm  = $npm"
}

if ($Target -eq 'backend') {
    Release-Port $BackendPort '后端'
    Invoke-BackendBuild $mvn
    $jar = Resolve-Jar
    Assert-ClassVersion $java
    $javaArgs = Get-JavaArgs $jar
    Write-Step "启动中：端口 $BackendPort（Ctrl+C 停止）"
    & $java @javaArgs
    exit $LASTEXITCODE
}

if ($Target -eq 'frontend') {
    Release-Port $FrontendPort '前端'
    Invoke-Frontend $npm
    exit $LASTEXITCODE
}

# ---- all：后端后台 + 前端前台 ----
Release-Port $BackendPort '后端'
Release-Port $FrontendPort '前端'
Invoke-BackendBuild $mvn
$jar = Resolve-Jar
Assert-ClassVersion $java
$backendProc = Start-BackendDetached $java (Get-JavaArgs $jar)

try {
    Invoke-Frontend $npm
} finally {
    if ($backendProc -and -not $backendProc.HasExited) {
        Write-Step "停止后端 PID=$($backendProc.Id)"
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 800
        if ((Get-PortOwner $BackendPort) -gt 0) {
            $owner = Get-PortOwner $BackendPort
            Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
        }
    }
}
exit 0
