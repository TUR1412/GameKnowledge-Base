## Summary / 概要

<!-- What changed and why? / 改了什么 & 为什么改？ -->

## Checklist / 自检清单

- [ ] I ran `npm run check:all` locally / 我已在本地运行 `npm run check:all`
- [ ] No external scripts/styles/images were introduced (CSP-safe) / 未引入外链资源（保证 CSP 兼容）
- [ ] If I changed HTML, I kept `skip-link` and `main#main` / 若改动 HTML，保留了可访问性入口（skip-link + main#main）
- [ ] If I added `<img>`, I set `alt` + `loading` + `decoding` / 若新增图片，已补齐 `alt/loading/decoding`
- [ ] If I changed `data.js`, I validated the data model / 若改动 `data.js`，已通过数据模型校验
- [ ] If user-facing behavior changed, I added notes/screenshots / 若有用户可见变化，已补充说明或截图

## Testing / 验证

<!-- Paste relevant output or mention what you ran / 写明验证方式 -->

- `npm run check:all`: (pass/fail)

