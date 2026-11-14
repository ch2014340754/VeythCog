# 表单体验增强 · 设计

## 1. 校验归属

AntD `Form` 负责字段级校验与错误渲染；异步请求结果（服务端拒绝、网络失败）继续用 `message` 提示。规则：

- 必填：`{ required: true, whitespace: true, message: '请填写…' }`
- 格式：`pattern` 正则，如 `HTTP_URL`
- 长度：`max`/`min`
- 跨字段：`validator` + `dependencies: ['password']`

## 2. BookmarkModal

- `useForm` 管理 `url` / `title`，`useWatch` 读取用于图标预览与回填。
- 图标模式（文字/上传/网站图标）不是标准输入：保留 `mode`、`text`、`color` 本地 state，用 `iconError` 内联显示「请填写图标文字 / 请先上传图标图片」。
- 保存：`await form.validateFields()` 通过后再做图标校验与请求；校验失败直接 `return`（错误由 `Form.Item` 渲染）。
- 打开弹窗时 `form.setFieldsValue` 回填编辑数据；「保存并继续」后 `form.resetFields()`。
- 异步上传/抓图标成功仍用 `message.success`（非校验反馈），失败用 `message.error`。

## 3. Login

- 登录、注册各一个 `Form` 实例（`loginForm` / `registerForm`），避免切换模式时字段互相污染。
- 提交按钮改 `htmlType="submit"`；`onPressEnter` 显式 `submit()`。
- 注册字段：`username`（必填）、`nickname`（可选）、`password`（≥6）、`confirm`（validator 比对 `password`）。
- 服务端失败仍用 `message.error(ApiError.message)`；`client.ts` 已保证消息为中文。

## 4. client.ts 错误本地化

`request()` / `uploadFile()` 捕获并转换：

| 异常 | 转换 |
|---|---|
| `DOMException` + `name === 'AbortError'`（超时） | `ApiError(408, '请求超时，请检查网络后重试')` |
| `TypeError`（fetch 网络失败/CORS） | `ApiError(0, '网络连接失败，请检查网络或服务地址')` |
| 其他 | 原样抛出 |

## 5. 验收

- 空表单提交：字段下方出现红色内联错误，不出现 warning toast。
- 登录：空用户名/空密码分别内联提示；注册密码 <6、两次不一致内联提示。
- 书签：网址格式错误内联提示；文字图标为空时图标区内联提示。
- 断网/超时：界面消息为中文。
- `npx tsc --noEmit` 0 错误、`npm run build` 通过。
- 暗色与亮色下错误色使用 `--color-error`，不硬编码。
