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
    指定 JDK 目录（需 21+）。默认自动挑：VEYTH_JAVA_HOME → JAVA_HOME（版本够才用）→ 常见安装路径。
    本机常有 jdk-11 / jdk-17 / jdk-21 多套，JAVA_HOME 指到 17 时会报
    UnsupportedClassVersionError（65 vs 61），脚本会自动纠正。

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
    [string]$JdkHome = ''
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
function Get-JdkMajorFromRelease($jdkHome) {
    $f = Join-Path $jdkHome 'release'
    if (-not (Test-Path -LiteralPath $f)) { return 0 }
    try {
        $txt = Get-Content -LiteralPath $f -Raw -ErrorAction Stop
        $m = [regex]::Match($txt, 'JAVA_VERSION="(\d+)')
        if ($m.Success) { return [int]$m.Groups[1].Value }
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
        $m = [regex]::Match($out, 'version "(\d+)')
        if ($m.Success) { return [int]$m.Groups[1].Value }
    } catch { } finally { $ErrorActionPreference = $prev }
    return 0
}

function Resolve-Jdk {
    $cands = @()
    if ($JdkHome) { $cands += $JdkHome }
    if ($env:VEYTH_JAVA_HOME) { $cands += $env:VEYTH_JAVA_HOME }
    if ($env:JAVA_HOME) { $cands += $env:JAVA_HOME }
    $cands += @('I:\Java\jdk-21', 'D:\Java\jdk-21', 'C:\Program Files\Java\jdk-21')
    foreach ($cmd in (Get-Command java.exe -All -ErrorAction SilentlyContinue)) {
        if ($cmd.Source) { $cands += (Split-Path -Parent (Split-Path -Parent $cmd.Source)) }
    }
    foreach ($h in $cands) {
        if (-not $h) { continue }
        $exe = Join-Path $h 'bin\java.exe'
        if (-not (Test-Path -LiteralPath $exe)) { continue }
        if ((Get-JavaMajor $exe) -ge 21) { return (Resolve-Path -LiteralPath $h).Path }
    }
    Fail '没有找到 JDK 21+（本项目 class 是 Java 21 编的）。装好后用 -JdkHome 指定，或设 VEYTH_JAVA_HOME'
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

function Get-JdkAndJava {
    $jdk = Resolve-Jdk
    $java = Join-Path $jdk 'bin\java.exe'
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
    $mvn = Get-MvnPath
    $java = Get-JdkAndJava
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
