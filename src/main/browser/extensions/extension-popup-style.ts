/** Scoped to the bundled iGuge welcome page; retain its original links and handlers. */
export const igugeWelcomeStyle = `
html, body { margin: 0 !important; padding: 0 !important; background: white !important; font-family: system-ui, sans-serif !important; }
body > main.container { width: 100% !important; max-width: none !important; padding: 24px !important; box-sizing: border-box; }
body > main.container > .card { width: 100% !important; margin: 0 !important; background: #faf9f7 !important; border: 1px solid #e7e5e4 !important; border-radius: 10px !important; }
.card-body { padding: 24px !important; }
.card-title { font-size: 20px !important; font-weight: 700 !important; color: #1c1917 !important; margin: 0 0 16px !important; }
.card-text { font-size: 15px !important; color: #44403c !important; margin: 0 !important; }
.card-text .btn-success { display: inline-flex !important; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 22px !important; background: #16a34a !important; color: white !important; border: 0 !important; border-radius: 8px !important; font-size: 14px !important; font-weight: 600 !important; line-height: 20px !important; }
.card-text .btn-success:hover { background: #15803d !important; }
.card-text .btn-success::before { content: ''; width: 16px; height: 16px; background: currentColor; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3'/%3E%3C/svg%3E") center / contain no-repeat; }
`
