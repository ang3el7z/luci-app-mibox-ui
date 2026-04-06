'use strict';
'require view';
'require fs';
'require ui';
'require rpc';
'require poll';
'require network';

const UCI_CONFIG = 'mibox-ui';
const UCI_SECTION = 'main';
const DEFAULT_CONFIG_PATH = '/opt/clash/config.yaml';
const DEFAULT_LOG_PATH = '/tmp/mibox.log';
const DEFAULT_SETTINGS_PATH = '/opt/clash/settings';
const APP_VERSION = '0.0.3';
const HELPER_BIN = '/usr/bin/mibox-ui/mibox-ui-helper';
const SUBSCRIPTION_BIN = '/usr/bin/mibox-ui/mibox-ui-subscription';
const ACE_BASE = '/luci-static/resources/view/mibox-ui/ace/';
const PRETTIER_STANDALONE_SRC = '/luci-static/resources/view/mibox-ui/vendor/prettier-standalone.js';
const PRETTIER_YAML_PLUGIN_SRC = '/luci-static/resources/view/mibox-ui/vendor/prettier-plugin-yaml.js';
const TMP_VALIDATE_PATH = '/tmp/mibox-ui-validate.yaml';
const VALIDATE_DEBOUNCE_MS = 700;
const MAX_LOG_LINES = 220;
const KERNEL_BIN_PRIMARY = '/opt/clash/bin/clash';
const KERNEL_BIN_FALLBACK = '/usr/bin/mihomo';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

const PAGE_STYLE = `
<style id="mibox-ui-style">
.mbox-page {
	--mb-bg: #0a1428;
	--mb-bg2: #081023;
	--mb-card: #0d1a33;
	--mb-card2: #0b1730;
	--mb-border: #243a63;
	--mb-text: #dce8ff;
	--mb-muted: #8ba4cf;
	--mb-accent: #3ea6ff;
	--mb-accent-soft: rgba(62, 166, 255, 0.2);
	--mb-good: #26c281;
	--mb-warn: #f6b73c;
	--mb-bad: #ff5f6d;
	color: var(--mb-text);
	padding: 0;
	font-family: "Segoe UI Variable", "Segoe UI", "Noto Sans", Arial, sans-serif;
}
.mbox-page.mbox-light {
	--mb-bg: #eef4ff;
	--mb-bg2: #f8fbff;
	--mb-card: #ffffff;
	--mb-card2: #f9fbff;
	--mb-border: #d4e0f4;
	--mb-text: #11203f;
	--mb-muted: #5c7396;
	--mb-accent: #1662c5;
	--mb-accent-soft: rgba(22, 98, 197, 0.15);
	--mb-good: #1d9f68;
	--mb-warn: #ca8a04;
	--mb-bad: #d64553;
}
.mbox-shell {
	background: linear-gradient(170deg, var(--mb-bg), var(--mb-bg2));
	border: 1px solid var(--mb-border);
	border-radius: 14px;
	padding: 0.68rem;
	box-shadow: 0 10px 34px rgba(2, 8, 20, 0.28);
}
.mbox-head {
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	align-items: center;
	gap: 0.45rem;
	padding: 0.28rem 0.22rem 0.5rem;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.mbox-light .mbox-head {
	border-bottom-color: rgba(17, 32, 63, 0.08);
}
.mbox-head-left,
.mbox-head-right {
	display: inline-flex;
	align-items: center;
	gap: 0.36rem;
	flex-wrap: wrap;
}
.mbox-title {
	font-size: 1.98rem;
	font-weight: 700;
	line-height: 1.1;
	margin: 0;
	letter-spacing: 0.01em;
	color: var(--mb-accent);
	text-align: center;
	text-shadow: 0 0 16px rgba(62, 166, 255, 0.22);
}
.mbox-head-right {
	justify-content: flex-end;
}
.mbox-pill {
	border: 1px solid var(--mb-border);
	border-radius: 999px;
	padding: 0.18rem 0.56rem;
	font-size: 0.76rem;
	background: rgba(10, 30, 64, 0.58);
	color: var(--mb-muted);
}
.mbox-light .mbox-pill {
	background: #f4f8ff;
}
.mbox-icon-btn {
	min-width: 30px;
	height: 28px;
	padding: 0 0.46rem;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
}
.mbox-toolbar {
	margin-top: 0.4rem;
	display: flex;
	flex-wrap: wrap;
	gap: 0.45rem;
	align-items: center;
	justify-content: space-between;
	padding: 0 0.22rem;
}
.mbox-toolbar-left,
.mbox-toolbar-right {
	display: inline-flex;
	flex-wrap: wrap;
	gap: 0.45rem;
	align-items: center;
}
.mbox-status {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	border-radius: 8px;
	padding: 0.28rem 0.54rem;
	font-size: 0.74rem;
	border: 1px solid var(--mb-border);
	background: rgba(12, 48, 36, 0.4);
	color: #62e79d;
}
.mbox-light .mbox-status {
	background: #e9f8f0;
	color: #1d9f68;
}
.mbox-status.mbox-status-stop {
	background: rgba(74, 18, 28, 0.4);
	color: #ff97a1;
}
.mbox-light .mbox-status.mbox-status-stop {
	background: #fff0f2;
	color: #c8414f;
}
.mbox-dot {
	display: inline-block;
	width: 8px;
	height: 8px;
	border-radius: 50%;
}
.mbox-dot-run {
	background: var(--mb-good);
	box-shadow: 0 0 10px rgba(38, 194, 129, 0.55);
}
.mbox-dot-stop {
	background: var(--mb-bad);
}
.mbox-btn {
	border: 1px solid var(--mb-border);
	background: rgba(7, 21, 45, 0.7);
	color: var(--mb-text);
	border-radius: 8px;
	padding: 0.34rem 0.64rem;
	font-size: 0.76rem;
	line-height: 1.15;
	cursor: pointer;
	transition: 150ms ease;
}
.mbox-light .mbox-btn {
	background: #f5f9ff;
}
.mbox-btn:hover:not(:disabled) {
	border-color: var(--mb-accent);
	box-shadow: 0 0 0 2px var(--mb-accent-soft);
}
.mbox-btn:disabled {
	opacity: 0.56;
	cursor: wait;
}
.mbox-btn-primary {
	background: linear-gradient(180deg, rgba(25, 162, 109, 0.96), rgba(15, 125, 84, 0.96));
	border-color: #1b9b69;
	color: #f2fff8;
}
.mbox-btn-danger {
	border-color: rgba(255, 95, 109, 0.55);
	background: rgba(102, 20, 31, 0.52);
	color: #ffd7dc;
}
.mbox-light .mbox-btn-danger {
	background: #fff2f4;
	color: #b83442;
}
.mbox-main {
	margin-top: 0.5rem;
	border: 1px solid var(--mb-border);
	border-radius: 12px;
	overflow: hidden;
	background: linear-gradient(180deg, var(--mb-card), var(--mb-card2));
}
.mbox-tabs {
	display: flex;
	gap: 0.14rem;
	padding: 0.36rem 0.4rem 0;
	border-bottom: 1px solid var(--mb-border);
}
.mbox-tab {
	background: transparent;
	color: var(--mb-muted);
	border: none;
	border-bottom: 2px solid transparent;
	padding: 0.44rem 0.48rem;
	font-weight: 600;
	font-size: 0.96rem;
	cursor: pointer;
}
.mbox-tab.active {
	color: var(--mb-text);
	border-bottom-color: var(--mb-accent);
}
.mbox-panel {
	display: none;
	padding: 0.56rem;
}
.mbox-panel.active {
	display: block;
}
.mbox-panel-head {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.6rem;
	flex-wrap: wrap;
	margin-bottom: 0.4rem;
}
.mbox-panel-tools {
	display: inline-flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.34rem;
}
.mbox-label {
	font-size: 0.78rem;
	color: var(--mb-muted);
}
.mbox-input,
.mbox-select {
	border: 1px solid var(--mb-border);
	background: rgba(7, 21, 45, 0.72);
	color: var(--mb-text);
	border-radius: 8px;
	padding: 0.34rem 0.5rem;
	font-size: 0.8rem;
}
.mbox-light .mbox-input,
.mbox-light .mbox-select {
	background: #fff;
}
.mbox-config-wrap {
	border: 1px solid var(--mb-border);
	border-radius: 10px;
	overflow: hidden;
	background: rgba(4, 16, 36, 0.72);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.mbox-light .mbox-config-wrap {
	background: #f9fbff;
}
.mbox-config-head {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	margin-bottom: 0.34rem;
}
.mbox-mini-tabs {
	display: inline-flex;
	flex-wrap: wrap;
	gap: 0.28rem;
}
.mbox-mini-tab {
	border: 1px solid var(--mb-border);
	border-radius: 999px;
	padding: 0.2rem 0.56rem;
	font-size: 0.72rem;
	line-height: 1.1;
	background: rgba(8, 22, 47, 0.58);
	color: var(--mb-muted);
}
.mbox-light .mbox-mini-tab {
	background: #eef5ff;
}
.mbox-mini-tab.active {
	color: var(--mb-text);
	border-color: var(--mb-accent);
	background: var(--mb-accent-soft);
}
.mbox-editor {
	width: 100%;
	height: 510px;
	border: none;
	background: #051127;
	color: #8fffb2;
	font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
	box-sizing: border-box;
	position: relative;
}
.mbox-light .mbox-editor {
	color: #1e3a5f;
	background: #ffffff;
}
.mbox-editor-textarea {
	width: 100%;
	height: 100%;
	border: none;
	resize: none;
	padding: 0.68rem 0.75rem;
	background: transparent;
	color: inherit;
	font: inherit;
	line-height: 1.4;
	box-sizing: border-box;
}
.mbox-editor-textarea:focus {
	outline: none;
}
.mbox-yaml-status {
	display: inline-flex;
	align-items: center;
	gap: 0.24rem;
	font-size: 0.75rem;
	color: var(--mb-muted);
	margin: 0;
}
.mbox-yaml-status.ok {
	color: var(--mb-good);
}
.mbox-yaml-status.err {
	color: var(--mb-bad);
}
.mbox-yaml-status.check {
	color: var(--mb-warn);
}
.mbox-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.34rem;
	margin-top: 0.44rem;
}
.mbox-config-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	margin-top: 0.38rem;
}
.mbox-config-actions {
	margin-top: 0;
	justify-content: flex-end;
}
.mbox-selector-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
	gap: 0.5rem;
}
.mbox-selector-card {
	border: 1px solid var(--mb-border);
	border-radius: 12px;
	padding: 0.54rem 0.58rem;
	background: rgba(10, 27, 56, 0.58);
}
.mbox-light .mbox-selector-card {
	background: #f5f8ff;
}
.mbox-selector-head {
	display: flex;
	justify-content: space-between;
	gap: 0.4rem;
	margin-bottom: 0.42rem;
	font-weight: 600;
	font-size: 0.83rem;
}
.mbox-opts {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
	gap: 0.36rem;
}
.mbox-opt {
	appearance: none;
	-webkit-appearance: none;
	display: inline-flex;
	align-items: center;
	justify-content: flex-start;
	border: 1px solid var(--mb-border);
	border-radius: 10px;
	padding: 0.35rem 0.56rem;
	min-height: 34px;
	font-size: 0.75rem;
	color: var(--mb-muted);
	background: rgba(5, 18, 39, 0.6);
	cursor: pointer;
	transition: 150ms ease;
}
.mbox-opt:hover:not(:disabled) {
	border-color: var(--mb-accent);
	color: var(--mb-text);
}
.mbox-opt:disabled {
	opacity: 0.55;
	cursor: wait;
}
.mbox-opt.active {
	color: var(--mb-text);
	border-color: var(--mb-accent);
	background: var(--mb-accent-soft);
}
.mbox-table-wrap {
	border: 1px solid var(--mb-border);
	border-radius: 8px;
	max-height: 510px;
	overflow: auto;
}
.mbox-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.78rem;
}
.mbox-table th,
.mbox-table td {
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	padding: 0.44rem 0.52rem;
	text-align: left;
	white-space: nowrap;
}
.mbox-light .mbox-table th,
.mbox-light .mbox-table td {
	border-bottom-color: rgba(17, 32, 63, 0.08);
}
.mbox-table th {
	color: var(--mb-muted);
	position: sticky;
	top: 0;
	z-index: 1;
	background: rgba(8, 19, 38, 0.88);
}
.mbox-light .mbox-table th {
	background: rgba(245, 249, 255, 0.95);
}
.mbox-table tbody tr:hover {
	background: rgba(62, 166, 255, 0.08);
}
.mbox-light .mbox-table tbody tr:hover {
	background: rgba(22, 98, 197, 0.08);
}
.mbox-conn-filter {
	min-width: 180px;
}
.mbox-conn-close {
	min-width: 28px;
	height: 24px;
	padding: 0 0.35rem;
}
.mbox-logs {
	margin-top: 0.52rem;
	border: 1px solid var(--mb-border);
	border-radius: 12px;
	padding: 0.56rem;
	background: linear-gradient(180deg, var(--mb-card), var(--mb-card2));
}
.mbox-logs-head {
	display: flex;
	gap: 0.45rem;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	margin-bottom: 0.45rem;
}
.mbox-logs-tools {
	display: inline-flex;
	gap: 0.45rem;
	flex-wrap: wrap;
}
.mbox-log-pre {
	max-height: 230px;
	overflow: auto;
	border: 1px solid var(--mb-border);
	border-radius: 8px;
	background: rgba(4, 16, 36, 0.8);
	padding: 0.46rem;
	font: 12px/1.38 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
	color: var(--mb-text);
	white-space: pre-wrap;
	word-break: break-word;
}
.mbox-light .mbox-log-pre {
	background: #f9fbff;
}
.mbox-empty {
	color: var(--mb-muted);
	font-size: 0.8rem;
}
.mbox-settings-grid {
	display: grid;
	gap: 0.5rem;
}
.mbox-section {
	border: 1px solid var(--mb-border);
	border-radius: 10px;
	padding: 0.58rem;
	background: rgba(9, 25, 53, 0.55);
}
.mbox-light .mbox-section {
	background: #f6f9ff;
}
.mbox-section h3 {
	margin: 0 0 0.32rem;
	font-size: 0.86rem;
}
.mbox-help {
	font-size: 0.75rem;
	line-height: 1.35;
	color: var(--mb-muted);
	margin-bottom: 0.45rem;
}
.mbox-mode-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	gap: 0.42rem;
}
.mbox-mode-card {
	border: 1px solid var(--mb-border);
	border-radius: 9px;
	padding: 0.42rem 0.48rem;
	background: rgba(8, 22, 47, 0.54);
	cursor: pointer;
}
.mbox-light .mbox-mode-card {
	background: #fff;
}
.mbox-mode-card.active {
	border-color: var(--mb-accent);
	box-shadow: 0 0 0 2px var(--mb-accent-soft);
}
.mbox-mode-title {
	font-weight: 600;
	font-size: 0.8rem;
}
.mbox-mode-desc {
	font-size: 0.74rem;
	margin-top: 0.26rem;
	color: var(--mb-muted);
	line-height: 1.35;
}
.mbox-switch {
	display: flex;
	gap: 0.45rem;
	align-items: center;
	font-size: 0.79rem;
	padding: 0.42rem;
	border: 1px solid var(--mb-border);
	border-radius: 8px;
	background: rgba(8, 22, 47, 0.54);
}
.mbox-light .mbox-switch {
	background: #fff;
}
.mbox-proxy-desc {
	margin-top: 0.42rem;
	padding: 0.46rem;
	border-left: 3px solid var(--mb-accent);
	border-radius: 6px;
	background: rgba(9, 25, 53, 0.6);
	font-size: 0.75rem;
	line-height: 1.35;
}
.mbox-light .mbox-proxy-desc {
	background: #eef5ff;
}
.mbox-iface-groups {
	display: grid;
	gap: 0.42rem;
}
.mbox-iface-group {
	border: 1px solid var(--mb-border);
	border-radius: 8px;
	padding: 0.38rem;
}
.mbox-iface-title {
	margin: 0 0 0.34rem;
	font-size: 0.75rem;
	color: var(--mb-muted);
}
.mbox-iface-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
	gap: 0.36rem;
}
.mbox-iface-label {
	display: flex;
	align-items: center;
	gap: 0.36rem;
	border: 1px solid var(--mb-border);
	border-radius: 8px;
	padding: 0.3rem 0.35rem;
	background: rgba(8, 22, 47, 0.45);
	cursor: pointer;
	font-size: 0.74rem;
}
.mbox-light .mbox-iface-label {
	background: #fff;
}
.mbox-iface-label.checked {
	border-color: var(--mb-accent);
	background: var(--mb-accent-soft);
}
.mbox-iface-label.auto {
	border-color: var(--mb-good);
}
.mbox-iface-label input {
	display: none;
}
.mbox-iface-icon {
	font-size: 0.85rem;
}
.mbox-iface-name {
	flex: 1;
}
.mbox-auto {
	font-size: 0.65rem;
	color: var(--mb-good);
	font-weight: 700;
}
.mbox-summary {
	margin-top: 0.5rem;
	border: 1px solid var(--mb-border);
	border-radius: 8px;
	padding: 0.46rem;
	background: rgba(8, 22, 47, 0.45);
	font-size: 0.75rem;
	line-height: 1.35;
}
.mbox-light .mbox-summary {
	background: #f6f9ff;
}
.mbox-kernel {
	border: 1px solid var(--mb-border);
	border-radius: 8px;
	padding: 0.46rem;
	background: rgba(8, 22, 47, 0.45);
	font-size: 0.75rem;
	line-height: 1.35;
}
.mbox-light .mbox-kernel {
	background: #f6f9ff;
}
.mbox-sub-wrap {
	margin-bottom: 0.44rem;
}
.mbox-sub-row {
	display: grid;
	grid-template-columns: 1fr auto auto auto auto;
	gap: 0.35rem;
	align-items: center;
}
.mbox-sub-row .mbox-input {
	min-width: 240px;
}
.mbox-sub-status {
	margin-top: 0.32rem;
	font-size: 0.75rem;
	color: var(--mb-muted);
}
@media (max-width: 900px) {
	.mbox-head {
		grid-template-columns: 1fr;
		justify-items: center;
	}
	.mbox-head-left,
	.mbox-head-right {
		justify-content: center;
	}
	.mbox-title {
		font-size: 1.35rem;
	}
	.mbox-editor {
		height: 330px;
	}
	.mbox-config-foot {
		flex-direction: column;
		align-items: flex-start;
	}
	.mbox-config-actions {
		justify-content: flex-start;
		width: 100%;
	}
	.mbox-sub-row {
		grid-template-columns: 1fr 1fr;
	}
	.mbox-table th,
	.mbox-table td {
		font-size: 0.73rem;
	}
}
</style>`;

function injectStyle() {
	if (!document.getElementById('mibox-ui-style'))
		document.head.insertAdjacentHTML('beforeend', PAGE_STYLE);
}

const _scriptLoads = {};

function loadScriptOnce(src) {
	if (_scriptLoads[src])
		return _scriptLoads[src];

	_scriptLoads[src] = new Promise(function(resolve, reject) {
		const script = document.createElement('script');
		script.src = src;
		script.onload = resolve;
		script.onerror = reject;
		document.head.appendChild(script);
	});

	return _scriptLoads[src];
}

function createTextareaEditor(host, initial) {
	host.innerHTML = '';
	const textarea = E('textarea', { 'class': 'mbox-editor-textarea' });
	textarea.value = String(initial || '');
	host.appendChild(textarea);

	return {
		getValue: function() { return String(textarea.value || ''); },
		setValue: function(v) { textarea.value = String(v || ''); },
		onChange: function(cb) { textarea.addEventListener('input', cb); },
		focus: function() { textarea.focus(); }
	};
}

async function createAceEditor(host, initial) {
	await loadScriptOnce(ACE_BASE + 'ace.js');
	await Promise.all([
		loadScriptOnce(ACE_BASE + 'mode-yaml.js'),
		loadScriptOnce(ACE_BASE + 'theme-tomorrow_night_bright.js')
	]);

	if (!window.ace || typeof window.ace.edit !== 'function')
		throw new Error('ace not available');

	host.innerHTML = '';
	const aceEditor = window.ace.edit(host);
	window.ace.config.set('basePath', ACE_BASE.replace(/\/$/, ''));
	aceEditor.setTheme('ace/theme/tomorrow_night_bright');
	aceEditor.session.setMode('ace/mode/yaml');
	aceEditor.setShowPrintMargin(false);
	aceEditor.setOption('useSoftTabs', true);
	aceEditor.setOption('tabSize', 2);
	aceEditor.setOption('wrap', true);
	aceEditor.setOption('fontSize', '13px');
	aceEditor.setValue(String(initial || ''), -1);
	aceEditor.clearSelection();

	return {
		getValue: function() { return String(aceEditor.getValue() || ''); },
		setValue: function(v) { aceEditor.setValue(String(v || ''), -1); },
		onChange: function(cb) { aceEditor.session.on('change', cb); },
		focus: function() { aceEditor.focus(); },
		resize: function() { aceEditor.resize(); }
	};
}

function safeJsonParse(raw, fallback) {
	try {
		return JSON.parse(raw);
	}
	catch (e) {
		return fallback;
	}
}

function trimLog(raw) {
	if (!raw)
		return '';

	const rows = raw.trim().split('\n');
	return rows.slice(-MAX_LOG_LINES).join('\n');
}

function formatConfigText(raw) {
	const text = String(raw || '').replace(/\r\n/g, '\n');
	const rows = text.split('\n').map(function(line) {
		return line.replace(/\s+$/g, '');
	});
	return rows.join('\n').replace(/\n{4,}/g, '\n\n\n').replace(/\n?$/, '\n');
}

async function formatYamlDeep(raw) {
	const text = String(raw || '').replace(/\r\n/g, '\n');
	await loadScriptOnce(PRETTIER_STANDALONE_SRC);
	await loadScriptOnce(PRETTIER_YAML_PLUGIN_SRC);

	if (!window.prettier || !window.prettierPlugins || !window.prettierPlugins.yaml)
		throw new Error('prettier yaml unavailable');

	const formatted = await window.prettier.format(text, {
		parser: 'yaml',
		plugins: [ window.prettierPlugins.yaml ],
		printWidth: 120,
		tabWidth: 2,
		useTabs: false,
		singleQuote: false,
		proseWrap: 'preserve'
	});
	return String(formatted || '').replace(/\n?$/, '\n');
}

function toBoolString(value) {
	return value ? _('Running') : _('Stopped');
}

function detectLightTheme() {
	try {
		const color = window.getComputedStyle(document.body).backgroundColor || '';
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
		if (!match)
			return false;
		const r = parseInt(match[1], 10);
		const g = parseInt(match[2], 10);
		const b = parseInt(match[3], 10);
		return ((r + g + b) / 3) > 150;
	}
	catch (e) {
		return false;
	}
}

function formatBytes(bytes) {
	const n = Number(bytes) || 0;
	if (n < 1024) return n + ' B';
	if (n < (1024 * 1024)) return (n / 1024).toFixed(1) + ' KB';
	if (n < (1024 * 1024 * 1024)) return (n / (1024 * 1024)).toFixed(1) + ' MB';
	return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function normalizeSubscriptionInterval(value, hasUrl) {
	let normalized = String(value || '').trim().toLowerCase();
	if (![ 'off', '1h', '2h', '1d' ].includes(normalized))
		normalized = '2h';
	if (!hasUrl)
		normalized = 'off';
	return normalized;
}

function cycleSubscriptionInterval(value) {
	const current = normalizeSubscriptionInterval(value, true);
	if (current === 'off') return '1h';
	if (current === '1h') return '2h';
	if (current === '2h') return '1d';
	return 'off';
}

function subscriptionIntervalText(value) {
	const interval = normalizeSubscriptionInterval(value, true);
	if (interval === '1h') return _('1h');
	if (interval === '2h') return _('2h');
	if (interval === '1d') return _('1d');
	return _('Off');
}

function escHtml(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

async function getServiceRunning(serviceName) {
	const svc = serviceName || 'mibox-ui';
	try {
		const status = await callServiceList(svc);
		const instances = status[svc] ? status[svc].instances : null;
		if (!instances)
			return false;
		const keys = Object.keys(instances);
		return keys.length ? !!instances[keys[0]].running : false;
	}
	catch (e) {
		try {
			const res = await fs.exec('/etc/init.d/' + svc, [ 'status' ]);
			return (res && res.stdout && res.stdout.indexOf('running') >= 0);
		}
		catch (e2) {
			return false;
		}
	}
}

async function detectServiceName() {
	const candidates = [ 'clash', 'mibox-ui' ];
	for (let i = 0; i < candidates.length; i++) {
		const stat = await L.resolveDefault(fs.stat('/etc/init.d/' + candidates[i]), null);
		if (stat)
			return candidates[i];
	}
	return 'mibox-ui';
}

async function execUci(args) {
	return fs.exec('/sbin/uci', args);
}

async function getUci(option, fallback) {
	try {
		const res = await execUci([ 'get', UCI_CONFIG + '.' + UCI_SECTION + '.' + option ]);
		const value = String((res && res.stdout) || '').trim();
		return value || fallback;
	}
	catch (e) {
		return fallback;
	}
}

async function setUci(option, value) {
	await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '.' + option + '=' + String(value) ]);
	await execUci([ 'commit', UCI_CONFIG ]);
}

async function ensureUciDefaults() {
	let exists = true;
	try {
		await execUci([ 'get', UCI_CONFIG + '.' + UCI_SECTION ]);
	}
	catch (e) {
		exists = false;
	}

	if (!exists) {
		await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '=core' ]);
		await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '.enabled=0' ]);
		await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '.proxy_mode=tproxy' ]);
		await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '.tun_stack=system' ]);
		await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '.config_path=' + DEFAULT_CONFIG_PATH ]);
		await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '.log_path=' + DEFAULT_LOG_PATH ]);
		await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '.settings_path=' + DEFAULT_SETTINGS_PATH ]);
		await execUci([ 'set', UCI_CONFIG + '.' + UCI_SECTION + '.dashboard_port=9090' ]);
		await execUci([ 'commit', UCI_CONFIG ]);
	}
}

async function loadSelectors() {
	try {
		const res = await fs.exec(HELPER_BIN, [ 'fetch-selectors' ]);
		if (res && res.code === 0)
			return safeJsonParse(String(res.stdout || ''), { groups: [] });
	}
	catch (e) {}
	return { groups: [] };
}

async function loadConnections() {
	try {
		const res = await fs.exec(HELPER_BIN, [ 'fetch-connections' ]);
		if (res && res.code === 0)
			return safeJsonParse(String(res.stdout || ''), { total: 0, connections: [] });
	}
	catch (e) {}
	return { total: 0, connections: [] };
}

async function switchSelector(group, name) {
	try {
		const res = await fs.exec(HELPER_BIN, [ 'switch-selector', String(group || ''), String(name || '') ]);
		const body = String((res && res.stdout) || '').trim();
		return {
			ok: !!(res && res.code === 0),
			data: safeJsonParse(body, null),
			error: String((res && res.stderr) || '').trim()
		};
	}
	catch (e) {
		return { ok: false, data: null, error: e.message || 'failed' };
	}
}

async function closeConnection(id) {
	try {
		const res = await fs.exec(HELPER_BIN, [ 'close-connection', String(id || '') ]);
		const body = String((res && res.stdout) || '').trim();
		return {
			ok: !!(res && res.code === 0),
			data: safeJsonParse(body, null),
			error: String((res && res.stderr) || '').trim()
		};
	}
	catch (e) {
		return { ok: false, data: null, error: e.message || 'failed' };
	}
}

async function closeAllConnections() {
	try {
		const res = await fs.exec(HELPER_BIN, [ 'close-all-connections' ]);
		const body = String((res && res.stdout) || '').trim();
		return {
			ok: !!(res && res.code === 0),
			data: safeJsonParse(body, null),
			error: String((res && res.stderr) || '').trim()
		};
	}
	catch (e) {
		return { ok: false, data: null, error: e.message || 'failed' };
	}
}

async function readLogs(logPath, source) {
	if (source === 'system') {
		let out = '';
		try {
			const one = await fs.exec('/sbin/logread', [ '-e', 'mibox' ]);
			out += String((one && one.stdout) || '');
		}
		catch (e) {}

		try {
			const two = await fs.exec('/sbin/logread', [ '-e', 'mihomo' ]);
			const second = String((two && two.stdout) || '');
			if (second)
				out += '\n' + second;
		}
		catch (e2) {}

		return trimLog(out);
	}

	const raw = await L.resolveDefault(fs.read(logPath), '');
	return trimLog(raw);
}

async function runConfigCheck(path) {
	try {
		const res = await fs.exec(HELPER_BIN, [ 'check-config', path ]);
		return {
			ok: (res && res.code === 0),
			stdout: String((res && res.stdout) || '').trim(),
			stderr: String((res && res.stderr) || '').trim()
		};
	}
	catch (e) {
		return {
			ok: false,
			stdout: '',
			stderr: e.message || 'check failed'
		};
	}
}

async function refreshProvidersApi() {
	try {
		const res = await fs.exec(HELPER_BIN, [ 'refresh-providers' ]);
		const body = String((res && res.stdout) || '').trim();
		return {
			ok: !!(res && res.code === 0),
			data: safeJsonParse(body, null),
			raw: body,
			error: String((res && res.stderr) || '').trim()
		};
	}
	catch (e) {
		return { ok: false, data: null, raw: '', error: e.message || 'failed' };
	}
}

async function runSubscriptionAction(action, settingsPath, configPath, serviceName, quiet) {
	const args = [ action, settingsPath, configPath, serviceName ];
	if (quiet)
		args.push('--quiet');

	const result = await L.resolveDefault(fs.exec(SUBSCRIPTION_BIN, args), null);
	if (!result) {
		return {
			ok: false,
			data: null,
			stdout: '',
			stderr: _('Subscription action failed')
		};
	}

	const stdout = String((result.stdout || '')).trim();
	const stderr = String((result.stderr || '')).trim();
	return {
		ok: result.code === 0,
		data: safeJsonParse(stdout, null),
		stdout: stdout,
		stderr: stderr
	};
}

async function reloadConfigSafely(serviceName) {
	const reloadRes = await L.resolveDefault(fs.exec('/etc/init.d/' + serviceName, [ 'reload' ]), null);
	return {
		ok: !!(reloadRes && reloadRes.code === 0),
		method: 'service'
	};
}

function getDefaultAdvancedSettings(proxyMode) {
	return {
		interfaceMode: 'exclude',
		proxyMode: proxyMode || 'tproxy',
		tunStack: 'system',
		autoDetectWan: true,
		blockQuic: true,
		useTmpfsRules: true,
		detectedWan: '',
		includedInterfaces: [],
		excludedInterfaces: [],
		enableHwid: false,
		hwidUserAgent: 'MiboxUI',
		hwidDeviceOS: 'OpenWrt',
		subscriptionUrl: '',
		subscriptionInterval: 'off'
	};
}

async function loadAdvancedSettings(path, modeFallback) {
	const settings = getDefaultAdvancedSettings(modeFallback);
	try {
		const content = await L.resolveDefault(fs.read(path), '');
		content.split('\n').forEach(function(line) {
			const idx = line.indexOf('=');
			if (idx < 0)
				return;

			const key = line.slice(0, idx).trim();
			const value = line.slice(idx + 1).trim();

			switch (key) {
			case 'INTERFACE_MODE':
				settings.interfaceMode = value || 'exclude';
				break;
			case 'PROXY_MODE':
				settings.proxyMode = value || settings.proxyMode;
				break;
			case 'TUN_STACK':
				settings.tunStack = value || 'system';
				break;
			case 'AUTO_DETECT_WAN':
				settings.autoDetectWan = value === 'true';
				break;
			case 'BLOCK_QUIC':
				settings.blockQuic = value === 'true';
				break;
			case 'USE_TMPFS_RULES':
				settings.useTmpfsRules = value === 'true';
				break;
			case 'DETECTED_WAN':
				settings.detectedWan = value || '';
				break;
			case 'INCLUDED_INTERFACES':
				settings.includedInterfaces = value ? value.split(',').map(v => v.trim()).filter(Boolean) : [];
				break;
			case 'EXCLUDED_INTERFACES':
				settings.excludedInterfaces = value ? value.split(',').map(v => v.trim()).filter(Boolean) : [];
				break;
			case 'ENABLE_HWID':
				settings.enableHwid = value === 'true';
				break;
			case 'HWID_USER_AGENT':
				settings.hwidUserAgent = value || 'MiboxUI';
				break;
			case 'HWID_DEVICE_OS':
				settings.hwidDeviceOS = value || 'OpenWrt';
				break;
			case 'SUBSCRIPTION_URL':
				settings.subscriptionUrl = value || '';
				break;
			case 'SUBSCRIPTION_INTERVAL':
				settings.subscriptionInterval = value || 'off';
				break;
			}
		});
	}
	catch (e) {}

	if (![ 'exclude', 'explicit' ].includes(settings.interfaceMode))
		settings.interfaceMode = 'exclude';
	if (![ 'tproxy', 'tun', 'mixed' ].includes(settings.proxyMode))
		settings.proxyMode = modeFallback || 'tproxy';
	if (![ 'system', 'gvisor', 'mixed' ].includes(settings.tunStack))
		settings.tunStack = 'system';
	settings.subscriptionUrl = String(settings.subscriptionUrl || '').replace(/[\r\n]/g, '').trim();
	settings.subscriptionInterval = normalizeSubscriptionInterval(settings.subscriptionInterval, !!settings.subscriptionUrl);

	return settings;
}

async function saveAdvancedSettings(path, settings) {
	const included = settings.interfaceMode === 'explicit' ? settings.includedInterfaces : [];
	const excluded = settings.interfaceMode === 'exclude' ? settings.excludedInterfaces : [];
	const subUrl = String(settings.subscriptionUrl || '').replace(/[\r\n]/g, '').trim();
	const subInterval = normalizeSubscriptionInterval(settings.subscriptionInterval, !!subUrl);

	const lines = [
		'INTERFACE_MODE=' + settings.interfaceMode,
		'PROXY_MODE=' + settings.proxyMode,
		'TUN_STACK=' + settings.tunStack,
		'AUTO_DETECT_WAN=' + (settings.autoDetectWan ? 'true' : 'false'),
		'BLOCK_QUIC=' + (settings.blockQuic ? 'true' : 'false'),
		'USE_TMPFS_RULES=' + (settings.useTmpfsRules ? 'true' : 'false'),
		'DETECTED_WAN=' + (settings.detectedWan || ''),
		'INCLUDED_INTERFACES=' + included.join(','),
		'EXCLUDED_INTERFACES=' + excluded.join(','),
		'ENABLE_HWID=' + (settings.enableHwid ? 'true' : 'false'),
		'HWID_USER_AGENT=' + (settings.hwidUserAgent || 'MiboxUI'),
		'HWID_DEVICE_OS=' + (settings.hwidDeviceOS || 'OpenWrt'),
		'SUBSCRIPTION_URL=' + subUrl,
		'SUBSCRIPTION_INTERVAL=' + subInterval,
		''
	];

	await fs.write(path, lines.join('\n'));
}

function createInterfaceEntry(name) {
	let category = 'other';
	let icon = 'LINK';

	if (name.match(/\.\d+$/)) {
		category = 'ethernet';
		icon = 'VLAN';
	}
	else if (name.match(/^(br-|bridge)/)) {
		category = 'ethernet';
		icon = 'BR';
	}
	else if (name.match(/^(eth|lan|switch|bond|team)/)) {
		category = 'ethernet';
		icon = 'ETH';
	}
	else if (name.match(/^(wlan|wifi|ath|phy|ra|mt|rtl|iwl)/)) {
		category = 'wifi';
		icon = 'WIFI';
	}
	else if (name.match(/^(wan|ppp|modem|3g|4g|5g|lte|gsm|cdma|hsdpa|hsupa|umts)/)) {
		category = 'wan';
		icon = 'WAN';
	}
	else if (name.match(/^(tun|tap|vpn|wg|nord|express|surf|pia|ovpn|openvpn|l2tp|pptp|sstp|ikev2|ipsec)/)) {
		category = 'vpn';
		icon = 'VPN';
	}
	else if (name.match(/^(usb|rndis|cdc|ecm|ncm|qmi|rmnet|mbim)/)) {
		category = 'usb';
		icon = 'USB';
	}
	else if (name.match(/^(veth|macvlan|ipvlan|dummy|vrf|vcan|vxcan)/)) {
		category = 'virtual';
		icon = 'VRT';
	}

	return {
		name: name,
		description: name,
		category: category,
		icon: icon
	};
}

async function runIp(args) {
	try {
		return await fs.exec('/sbin/ip', args);
	}
	catch (e) {
		return fs.exec('/usr/sbin/ip', args);
	}
}

async function getNetworkInterfaces() {
	const result = [];
	const seenInterfaces = new Set();

	try {
		const sysNetResult = await fs.exec('/bin/ls', [ '/sys/class/net/' ]);
		if (sysNetResult.code === 0 && sysNetResult.stdout) {
			const rows = String(sysNetResult.stdout).trim().split('\n');
			rows.forEach(function(name) {
				name = name.trim();
				if (name && !seenInterfaces.has(name) && name !== 'lo') {
					seenInterfaces.add(name);
					result.push(createInterfaceEntry(name));
				}
			});
		}
	}
	catch (e) {}

	try {
		const ipResult = await runIp([ 'link', 'show' ]);
		if (ipResult.code === 0 && ipResult.stdout) {
			const lines = String(ipResult.stdout).split('\n');
			lines.forEach(function(line) {
				const match = line.match(/^\d+:\s+([^:@]+)/);
				if (match && match[1] && match[1] !== 'lo') {
					const name = match[1];
					if (!seenInterfaces.has(name)) {
						seenInterfaces.add(name);
						result.push(createInterfaceEntry(name));
					}
				}
			});
		}
	}
	catch (e) {}

	try {
		const bridgeResult = await fs.exec('/usr/sbin/brctl', [ 'show' ]);
		if (bridgeResult.code === 0 && bridgeResult.stdout) {
			const lines = String(bridgeResult.stdout).split('\n');
			lines.forEach(function(line) {
				const match = line.match(/^([^\s]+)\s/);
				if (match && match[1] && match[1] !== 'bridge') {
					const name = match[1];
					if (!seenInterfaces.has(name)) {
						seenInterfaces.add(name);
						result.push(createInterfaceEntry(name));
					}
				}
			});
		}
	}
	catch (e) {}

	try {
		const devices = await network.getDevices();
		devices.forEach(function(iface) {
			const name = iface.getName();
			if (name && name !== 'lo' && !seenInterfaces.has(name)) {
				seenInterfaces.add(name);
				result.push(createInterfaceEntry(name));
			}
		});
	}
	catch (e) {}

	return result
		.filter(iface => iface.name !== 'clash-tun')
		.sort((a, b) => {
			const order = [ 'wan', 'ethernet', 'wifi', 'usb', 'vpn', 'virtual', 'other' ];
			const diff = order.indexOf(a.category) - order.indexOf(b.category);
			return diff !== 0 ? diff : a.name.localeCompare(b.name);
		});
}

async function detectWanInterface() {
	try {
		const networks = await network.getNetworks();
		for (const net of networks) {
			if (net.getName() === 'wan' || net.getName() === 'wan6') {
				const device = net.getL3Device();
				if (device && device.getName())
					return device.getName();
			}
		}
	}
	catch (e) {}

	try {
		const routeContent = await L.resolveDefault(fs.read('/proc/net/route'), '');
		const lines = String(routeContent).split('\n');
		for (const line of lines) {
			const fields = line.split('\t');
			if (fields[1] === '00000000' && fields[0] !== 'Iface')
				return fields[0];
		}
	}
	catch (e) {}

	return '';
}

function detectCurrentProxyMode(configText) {
	try {
		if (!configText)
			return 'tproxy';

		let hasTproxy = false;
		let hasTun = false;
		const lines = String(configText).split('\n');
		for (let i = 0; i < lines.length; i++) {
			const trimmed = lines[i].trim();
			if (trimmed.match(/^tproxy-port:/) && !trimmed.startsWith('#'))
				hasTproxy = true;

			if (trimmed.match(/^tun:/)) {
				for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
					if (String(lines[j]).trim() === 'enable: true') {
						hasTun = true;
						break;
					}
				}
			}
		}

		if (hasTproxy && hasTun) return 'mixed';
		if (hasTun) return 'tun';
		if (hasTproxy) return 'tproxy';
	}
	catch (e) {}

	return 'tproxy';
}

function transformProxyMode(content, proxyMode, tunStack) {
	const lines = String(content || '').split('\n');
	const out = [];
	let inTunSection = false;
	let tunIndentLevel = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (trimmed.match(/^#\s*Proxy\s+Mode:/i))
			continue;
		if (trimmed.match(/^tproxy-port:/))
			continue;

		if (trimmed.match(/^tun:/)) {
			inTunSection = true;
			tunIndentLevel = line.search(/\S/);
			continue;
		}

		if (inTunSection) {
			const currentIndent = line.search(/\S/);
			if (trimmed === '' || trimmed.startsWith('#') || (currentIndent > tunIndentLevel && trimmed !== ''))
				continue;
			inTunSection = false;
		}

		out.push(line);
	}

	let insertIndex = out.length;
	for (let i = 0; i < out.length; i++) {
		if (out[i].trim().match(/^mode:/)) {
			insertIndex = i + 1;
			break;
		}
	}

	const stack = [ 'system', 'gvisor', 'mixed' ].includes(tunStack) ? tunStack : 'system';
	let configToInsert = [];
	switch (proxyMode) {
	case 'tun':
		configToInsert = [
			'# Proxy Mode: TUN',
			'tun:',
			'  enable: true',
			'  device: clash-tun',
			'  stack: ' + stack,
			'  auto-route: false',
			'  auto-redirect: false',
			'  auto-detect-interface: false'
		];
		break;
	case 'mixed':
		configToInsert = [
			'# Proxy Mode: MIXED (TCP via TPROXY, UDP via TUN)',
			'tproxy-port: 7894',
			'tun:',
			'  enable: true',
			'  device: clash-tun',
			'  stack: ' + stack,
			'  auto-route: false',
			'  auto-redirect: false',
			'  auto-detect-interface: false'
		];
		break;
	default:
		configToInsert = [
			'# Proxy Mode: TPROXY',
			'tproxy-port: 7894'
		];
		break;
	}

	out.splice(insertIndex, 0, '', ...configToInsert);
	return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n?$/, '\n');
}

async function getHwidValues() {
	let hwid = 'unknown';
	let verOs = 'unknown';
	let deviceModel = 'Router';

	try {
		const macResult = await fs.exec('/bin/sh', [ '-c', "cat /sys/class/net/eth0/address 2>/dev/null | tr -d ':' | md5sum | cut -c1-14" ]);
		if (macResult.code === 0 && macResult.stdout)
			hwid = String(macResult.stdout).trim();
	}
	catch (e) {}

	try {
		const verResult = await fs.exec('/bin/sh', [ '-c', ". /etc/openwrt_release 2>/dev/null && echo $DISTRIB_RELEASE" ]);
		if (verResult.code === 0 && verResult.stdout)
			verOs = String(verResult.stdout).trim();
	}
	catch (e) {}

	try {
		const modelResult = await fs.exec('/bin/sh', [ '-c', 'cat /tmp/sysinfo/model 2>/dev/null' ]);
		if (modelResult.code === 0 && modelResult.stdout)
			deviceModel = String(modelResult.stdout).trim();
	}
	catch (e) {}

	return { hwid: hwid, verOs: verOs, deviceModel: deviceModel };
}

function addHwidToYaml(yamlContent, userAgent, deviceOS, hwid, verOs, deviceModel) {
	const lines = String(yamlContent || '').split('\n');
	const result = [];
	let inProxyProviders = false;
	let inProvider = false;
	let currentProvider = [];
	let hasHeader = false;

	function flushProvider() {
		result.push(...currentProvider);
		if (!hasHeader) {
			while (result.length > 0 && result[result.length - 1].trim() === '')
				result.pop();
			result.push('    header:');
			result.push(`      User-Agent: [${userAgent}]`);
			result.push(`      x-hwid: [${hwid}]`);
			result.push(`      x-device-os: [${deviceOS}]`);
			result.push(`      x-ver-os: [${verOs}]`);
			result.push(`      x-device-model: [${deviceModel}]`);
			result.push('');
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.match(/^proxy-providers:\s*$/)) {
			inProxyProviders = true;
			result.push(line);
			continue;
		}

		if (inProxyProviders) {
			if (line.match(/^[a-zA-Z]/)) {
				if (inProvider) flushProvider();
				inProxyProviders = false;
				inProvider = false;
				result.push(line);
				continue;
			}

			const providerMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
			if (providerMatch) {
				if (inProvider) flushProvider();
				currentProvider = [ line ];
				inProvider = true;
				hasHeader = false;
				continue;
			}

			if (inProvider && line.match(/^    header:\s*$/))
				hasHeader = true;

			if (inProvider) currentProvider.push(line);
			else result.push(line);
		}
		else {
			result.push(line);
		}
	}

	if (inProvider)
		flushProvider();
	return result.join('\n');
}

async function detectSystemArchitecture() {
	try {
		const releaseInfo = await L.resolveDefault(fs.read('/etc/openwrt_release'), '');
		const match = String(releaseInfo).match(/^DISTRIB_ARCH='([^']+)'/m);
		const arch = match ? match[1] : '';
		if (!arch) return 'amd64';
		if (arch.startsWith('aarch64_')) return 'arm64';
		if (arch === 'x86_64') return 'amd64';
		if (arch.startsWith('i386_')) return '386';
		if (arch.startsWith('riscv64_')) return 'riscv64';
		if (arch.startsWith('loongarch64_')) return 'loong64';
		if (arch.includes('_neon-vfp')) return 'armv7';
		if (arch.includes('_neon') || arch.includes('_vfp')) return 'armv6';
		if (arch.startsWith('arm_')) return 'armv5';
		if (arch.startsWith('mips64el_')) return 'mips64le';
		if (arch.startsWith('mips64_')) return 'mips64';
		if (arch.startsWith('mipsel_')) return arch.includes('hardfloat') ? 'mipsle-hardfloat' : 'mipsle-softfloat';
		if (arch.startsWith('mips_')) return arch.includes('hardfloat') ? 'mips-hardfloat' : 'mips-softfloat';
	}
	catch (e) {}
	return 'amd64';
}

async function getLatestMihomoRelease() {
	try {
		const response = await fetch('https://api.github.com/repos/MetaCubeX/mihomo/releases/latest');
		if (!response.ok)
			throw new Error('HTTP ' + response.status);
		const data = await response.json();
		return { version: data.tag_name, assets: data.assets || [] };
	}
	catch (e) {
		return null;
	}
}

async function getKernelStatus() {
	const primary = await L.resolveDefault(fs.stat(KERNEL_BIN_PRIMARY), null);
	const fallback = await L.resolveDefault(fs.stat(KERNEL_BIN_FALLBACK), null);
	const bin = primary ? KERNEL_BIN_PRIMARY : (fallback ? KERNEL_BIN_FALLBACK : '');
	if (!bin)
		return { installed: false, version: '', path: '' };

	try {
		const res = await fs.exec(bin, [ '-v' ]);
		const out = String((res && (res.stdout || res.stderr)) || '');
		const match = out.match(/(v\d+\.\d+\.\d+)/i);
		return {
			installed: true,
			version: match ? match[1] : (out.split('\n')[0] || 'installed'),
			path: bin
		};
	}
	catch (e) {
		return { installed: true, version: 'installed', path: bin };
	}
}

async function installKernel(downloadUrl, version, arch, targetPath) {
	const fileName = `mihomo-linux-${arch}-${version}.gz`;
	const gzPath = '/tmp/' + fileName;
	const extracted = gzPath.replace(/\.gz$/, '');
	const dir = targetPath.replace(/\/[^/]+$/, '');

	await fs.exec('/bin/mkdir', [ '-p', dir ]);
	const dl = await fs.exec('/usr/bin/curl', [ '-L', downloadUrl, '-o', gzPath ]);
	if (dl.code !== 0)
		throw new Error(_('Download failed'));

	const unzip = await fs.exec('/bin/gzip', [ '-df', gzPath ]);
	if (unzip.code !== 0)
		throw new Error(_('Extraction failed'));

	const mv = await fs.exec('/bin/mv', [ extracted, targetPath ]);
	if (mv.code !== 0)
		throw new Error(_('Install failed'));

	await fs.exec('/bin/chmod', [ '+x', targetPath ]);
}

function renderSelectors(node, data) {
	const groups = (data && data.groups) ? data.groups : [];
	if (!groups.length) {
		node.innerHTML = '<div class="mbox-empty">' + _('No selector data. Start Mihomo and open external-controller API.') + '</div>';
		return;
	}

	const blocks = groups.map(function(g) {
		const opts = (g.options || []).slice(0, 24).map(function(opt) {
			const active = (opt === g.now) ? ' active' : '';
			return '' +
				'<button type="button" class="mbox-opt' + active + '" data-role="selector-opt" data-group="' + escHtml(g.name || '') + '" data-option="' + escHtml(opt) + '"' + (active ? ' disabled' : '') + '>' +
					escHtml(opt) +
				'</button>';
		}).join('');

		return '' +
			'<div class="mbox-selector-card">' +
				'<div class="mbox-selector-head">' +
					'<span>' + escHtml(g.name) + '</span>' +
					'<span class="mbox-label">' + escHtml(g.now || '-') + '</span>' +
				'</div>' +
				'<div class="mbox-opts">' + opts + '</div>' +
			'</div>';
	}).join('');

	node.innerHTML = '<div class="mbox-selector-grid">' + blocks + '</div>';
}

function renderConnections(node, data, filterText) {
	const all = (data && data.connections) ? data.connections : [];
	const query = String(filterText || '').trim().toLowerCase();
	const list = query
		? all.filter(function(row) {
			const chain = String(row.chain || '').toLowerCase();
			const host = String(row.host || '').toLowerCase();
			const source = String(row.source || '').toLowerCase();
			return chain.includes(query) || host.includes(query) || source.includes(query);
		})
		: all;

	if (!all.length) {
		node.innerHTML = '<div class="mbox-empty">' + _('No active connections.') + '</div>';
		return;
	}
	if (!list.length) {
		node.innerHTML = '<div class="mbox-empty">' + _('No matching connections.') + '</div>';
		return;
	}

	const rows = list.map(function(row) {
		const id = escHtml(row.id || '');
		const chain = escHtml(row.chain || '-');
		const host = escHtml(row.host || '-');
		const source = escHtml(row.source || '-');
		const up = formatBytes(row.upload || 0);
		const down = formatBytes(row.download || 0);
		const time = escHtml(row.start || '-');
		return '' +
			'<tr>' +
				'<td>' + chain + '</td>' +
				'<td>' + host + '</td>' +
				'<td>' + source + '</td>' +
				'<td>&uarr; ' + up + '<br>&darr; ' + down + '</td>' +
				'<td>' + time + '</td>' +
				'<td><button type="button" class="mbox-btn mbox-icon-btn mbox-conn-close" data-role="close-connection" data-conn-id="' + id + '" title="' + _('Close connection') + '">&times;</button></td>' +
			'</tr>';
	}).join('');

	node.innerHTML = '' +
		'<div class="mbox-table-wrap">' +
			'<table class="mbox-table">' +
				'<thead><tr>' +
					'<th>' + _('Chain') + '</th>' +
					'<th>' + _('Host') + '</th>' +
					'<th>' + _('Source') + '</th>' +
					'<th>' + _('Traffic') + '</th>' +
					'<th>' + _('Time') + '</th>' +
					'<th></th>' +
				'</tr></thead>' +
				'<tbody>' + rows + '</tbody>' +
			'</table>' +
		'</div>';
}

function getSettingsInterfaces(settings) {
	const list = settings.interfaceMode === 'explicit'
		? (settings.includedInterfaces || []).slice()
		: (settings.excludedInterfaces || []).slice();

	if (settings.interfaceMode === 'exclude' && settings.autoDetectWan && settings.detectedWan && !list.includes(settings.detectedWan))
		list.push(settings.detectedWan);

	return list;
}

function renderInterfacesPanel(root, state) {
	const titleNode = root.querySelector('[data-role="iface-title"]');
	const descNode = root.querySelector('[data-role="iface-desc"]');
	const holder = root.querySelector('[data-role="iface-list"]');
	const selected = getSettingsInterfaces(state.advancedSettings);

	titleNode.textContent = state.advancedSettings.interfaceMode === 'explicit'
		? _('Select interfaces to process')
		: _('Select interfaces to exclude');

	descNode.textContent = state.advancedSettings.interfaceMode === 'explicit'
		? _('Traffic from these interfaces will be processed by the proxy.')
		: _('Traffic from these interfaces will bypass the proxy (direct routing).');

	const categories = {};
	const order = [ 'wan', 'ethernet', 'wifi', 'usb', 'vpn', 'virtual', 'other' ];
	const names = {
		wan: _('WAN Interfaces'),
		ethernet: _('Ethernet Interfaces'),
		wifi: _('Wi-Fi interfaces'),
		usb: _('USB Interfaces'),
		vpn: _('VPN Interfaces'),
		virtual: _('Virtual Interfaces'),
		other: _('Other Interfaces')
	};

	state.interfaces.forEach(function(iface) {
		if (!categories[iface.category])
			categories[iface.category] = [];
		categories[iface.category].push(iface);
	});

	let html = '';
	order.forEach(function(cat) {
		const list = categories[cat] || [];
		if (!list.length)
			return;

		const rows = list.map(function(iface) {
			const checked = selected.includes(iface.name);
			const auto = state.advancedSettings.interfaceMode === 'exclude' && state.advancedSettings.autoDetectWan && iface.name === state.advancedSettings.detectedWan;
			const cls = 'mbox-iface-label' + (checked ? ' checked' : '') + (auto ? ' auto' : '');
			return '' +
				'<label class="' + cls + '">' +
					'<input type="checkbox" data-role="iface-check" value="' + escHtml(iface.name) + '"' + (checked ? ' checked' : '') + '>' +
					'<span class="mbox-iface-icon">' + escHtml(iface.icon) + '</span>' +
					'<span class="mbox-iface-name">' + escHtml(iface.name) + '</span>' +
					(auto ? '<span class="mbox-auto">AUTO</span>' : '') +
				'</label>';
		}).join('');

		html += '' +
			'<div class="mbox-iface-group">' +
				'<h4 class="mbox-iface-title">' + escHtml(names[cat] || cat) + '</h4>' +
				'<div class="mbox-iface-grid">' + rows + '</div>' +
			'</div>';
	});

	holder.innerHTML = '<div class="mbox-iface-groups">' + html + '</div>';

	const checks = holder.querySelectorAll('[data-role="iface-check"]');
	for (let i = 0; i < checks.length; i++) {
		checks[i].addEventListener('change', function(ev) {
			const label = ev.target.closest('.mbox-iface-label');
			if (label)
				label.classList.toggle('checked', ev.target.checked);
		});
	}
}

function renderProxyDesc(root, mode) {
	const desc = root.querySelector('[data-role="proxy-desc"]');
	const stackWrap = root.querySelector('[data-role="tun-stack-wrap"]');
	if (mode === 'tun') {
		desc.textContent = _('TUN: TUN interface mode. Creates virtual network interface for all traffic. Better performance and works without TPROXY.');
		stackWrap.style.display = 'flex';
	}
	else if (mode === 'mixed') {
		desc.textContent = _('MIXED: Hybrid mode. TCP via TPROXY and UDP via TUN. Usually optimal for gaming and low-latency UDP.');
		stackWrap.style.display = 'flex';
	}
	else {
		desc.textContent = _('TPROXY: Transparent proxy mode. Routes TCP and UDP through TPROXY port 7894.');
		stackWrap.style.display = 'none';
	}
}

function readManualSelection(root, settings) {
	const list = [];
	const checks = root.querySelectorAll('[data-role="iface-check"]:checked');
	for (let i = 0; i < checks.length; i++)
		list.push(checks[i].value);

	if (settings.interfaceMode === 'exclude' && settings.autoDetectWan && settings.detectedWan)
		return list.filter(x => x !== settings.detectedWan);
	return list;
}

function renderSettingsSummary(root, state) {
	const summary = root.querySelector('[data-role="settings-summary"]');
	const detect = root.querySelector('[data-role="detect-summary"]');
	const manual = readManualSelection(root, state.advancedSettings);
	const lines = [];

	if (state.advancedSettings.interfaceMode === 'explicit') {
		lines.push(_('Mode: Explicit (process only selected)'));
		if (manual.length)
			lines.push(_('Manual selection: %s').format(manual.join(', ')));
		else
			lines.push(_('No interfaces configured'));
		detect.textContent = _('Explicit mode enabled (manual control)');
	}
	else {
		lines.push(_('Mode: Exclude (process all except selected)'));
		if (state.advancedSettings.autoDetectWan && state.advancedSettings.detectedWan)
			lines.push(_('Auto-detected WAN: %s').format(state.advancedSettings.detectedWan));
		if (manual.length)
			lines.push(_('Manual exclusions: %s').format(manual.join(', ')));
		if (!manual.length && !state.advancedSettings.autoDetectWan)
			lines.push(_('No exclusions configured'));

		detect.textContent = state.advancedSettings.detectedWan
			? _('Available WAN interface: %s').format(state.advancedSettings.detectedWan)
			: _('No WAN interface detected');
	}

	summary.innerHTML = lines.map(line => '<div>' + escHtml(line) + '</div>').join('');
}

function renderKernelSummary(root, kernel, latest, arch) {
	const box = root.querySelector('[data-role="kernel-status"]');
	let html = '';
	if (kernel.installed) {
		html += '<div>' + escHtml(_('Kernel status: Installed')) + '</div>';
		html += '<div>' + escHtml(_('Version: %s').format(kernel.version || '-')) + '</div>';
	}
	else {
		html += '<div>' + escHtml(_('Kernel status: Not installed')) + '</div>';
	}
	html += '<div>' + escHtml(_('System architecture: %s').format(arch || '-')) + '</div>';
	if (latest && latest.version)
		html += '<div>' + escHtml(_('Latest available: %s').format(latest.version)) + '</div>';
	box.innerHTML = html;
}

function renderSubscriptionControls(root, state) {
	const input = root.querySelector('[data-role="sub-url"]');
	const saveBtn = root.querySelector('[data-role="sub-save"]');
	const refreshBtn = root.querySelector('[data-role="sub-refresh"]');
	const deleteBtn = root.querySelector('[data-role="sub-delete"]');
	const intervalBtn = root.querySelector('[data-role="sub-interval"]');
	const status = root.querySelector('[data-role="sub-status"]');

	if (!input || !saveBtn || !refreshBtn || !deleteBtn || !intervalBtn || !status)
		return;

	const savedUrl = String(state.advancedSettings.subscriptionUrl || '').trim();
	const draftUrl = String(input.value || '').trim();
	const hasSaved = savedUrl.length > 0;
	const changed = draftUrl.length > 0 && draftUrl !== savedUrl;

	saveBtn.style.display = changed ? 'inline-flex' : 'none';
	saveBtn.disabled = !changed;
	refreshBtn.style.display = hasSaved ? 'inline-flex' : 'none';
	deleteBtn.style.display = hasSaved ? 'inline-flex' : 'none';

	const interval = normalizeSubscriptionInterval(state.advancedSettings.subscriptionInterval, hasSaved);
	state.advancedSettings.subscriptionInterval = interval;
	intervalBtn.disabled = !hasSaved;
	intervalBtn.textContent = _('Auto: %s').format(subscriptionIntervalText(interval));

	if (hasSaved)
		status.textContent = _('Subscription configured. Last mode: %s').format(subscriptionIntervalText(interval));
	else
		status.textContent = _('Subscription is not configured.');
}

function renderStatus(root, state) {
	const dot = root.querySelector('[data-role="status-dot"]');
	const text = root.querySelector('[data-role="status-text"]');
	const btn = root.querySelector('[data-role="toggle-service"]');
	const mode = root.querySelector('[data-role="mode-select"]');
	const status = root.querySelector('.mbox-status');

	if (dot)
		dot.className = 'mbox-dot ' + (state.running ? 'mbox-dot-run' : 'mbox-dot-stop');
	if (status)
		status.classList.toggle('mbox-status-stop', !state.running);
	if (text)
		text.textContent = toBoolString(state.running);
	if (btn) {
		btn.textContent = state.running ? '\u25A0' : '\u25B6';
		btn.title = state.running ? _('Stop') : _('Start');
	}
	if (mode)
		mode.value = state.mode;
}

function renderLogs(root, state) {
	const pre = root.querySelector('[data-role="log-pre"]');
	const filterInput = root.querySelector('[data-role="log-filter"]');
	const filter = String((filterInput && filterInput.value) || '').trim().toLowerCase();

	let text = state.logs || '';
	if (filter) {
		const rows = text.split('\n').filter(function(line) {
			return line.toLowerCase().indexOf(filter) >= 0;
		});
		text = rows.join('\n');
	}

	pre.textContent = text || _('No logs yet.');
}

function setTab(root, tab) {
	const tabs = root.querySelectorAll('[data-role="tab"]');
	const panels = root.querySelectorAll('[data-role="panel"]');

	for (let i = 0; i < tabs.length; i++) {
		const button = tabs[i];
		const isActive = (button.getAttribute('data-tab') === tab);
		button.classList.toggle('active', isActive);
	}

	for (let j = 0; j < panels.length; j++) {
		const panel = panels[j];
		const visible = (panel.getAttribute('data-panel') === tab);
		panel.classList.toggle('active', visible);
	}
}

async function withBusy(button, callback) {
	const old = button.textContent;
	const busyText = _('Working...');
	button.disabled = true;
	button.textContent = busyText;
	try {
		return await callback();
	}
	finally {
		button.disabled = false;
		if (button.textContent === busyText)
			button.textContent = old;
	}
}

return view.extend({
	load: async function() {
		await ensureUciDefaults();

		const serviceName = await detectServiceName();
		const configPath = await getUci('config_path', DEFAULT_CONFIG_PATH);
		const logPath = await getUci('log_path', DEFAULT_LOG_PATH);
		const settingsPath = await getUci('settings_path', DEFAULT_SETTINGS_PATH);
		const mode = await getUci('proxy_mode', 'tproxy');
		const configText = await L.resolveDefault(fs.read(configPath), '');
		const proxyMode = detectCurrentProxyMode(configText || '');
		const advancedSettings = await loadAdvancedSettings(settingsPath, proxyMode || mode);
		const interfaces = await getNetworkInterfaces();
		if (!advancedSettings.detectedWan)
			advancedSettings.detectedWan = await detectWanInterface();
		const kernel = await getKernelStatus();
		const arch = await detectSystemArchitecture();
		const latestKernel = await getLatestMihomoRelease();

		const results = await Promise.all([
			getServiceRunning(serviceName),
			loadSelectors(),
			loadConnections(),
			readLogs(logPath, 'file')
		]);

		return {
			serviceName: serviceName,
			running: results[0],
			selectors: results[1],
			connections: results[2],
			logs: results[3],
			configText: configText,
			configPath: configPath,
			logPath: logPath,
			mode: advancedSettings.proxyMode || mode,
			settingsPath: settingsPath,
			advancedSettings: advancedSettings,
			interfaces: interfaces,
			kernel: kernel,
			latestKernel: latestKernel,
			arch: arch
		};
	},

	render: function(state) {
		injectStyle();

		const root = E('div', { 'class': 'mbox-page' });
		if (detectLightTheme())
			root.classList.add('mbox-light');

		root.innerHTML = '' +
			'<div class="mbox-shell">' +
				'<div class="mbox-head">' +
					'<div class="mbox-head-left">' +
						'<span class="mbox-status"><span data-role="status-dot" class="mbox-dot"></span><span data-role="status-text"></span></span>' +
						'<button type="button" data-role="toggle-service" class="mbox-btn mbox-icon-btn"></button>' +
						'<button type="button" data-role="restart-service" class="mbox-btn mbox-icon-btn" title="' + _('Restart') + '">&#x21bb;</button>' +
					'</div>' +
					'<h2 class="mbox-title">XKeen UI</h2>' +
					'<div class="mbox-head-right">' +
						'<span class="mbox-pill">Mihomo</span>' +
						'<span class="mbox-pill" data-role="kernel-pill">-</span>' +
						'<span class="mbox-pill">' + escHtml(APP_VERSION) + '</span>' +
						'<button type="button" data-role="refresh-all" class="mbox-btn mbox-icon-btn" title="' + _('Refresh') + '">&#x21bb;</button>' +
					'</div>' +
				'</div>' +

				'<div class="mbox-toolbar">' +
					'<div class="mbox-toolbar-left">' +
						'<span class="mbox-label">' + _('Routing mode') + '</span>' +
						'<select data-role="mode-select" class="mbox-select">' +
							'<option value="tproxy">TPROXY</option>' +
							'<option value="tun">TUN</option>' +
							'<option value="mixed">MIXED</option>' +
						'</select>' +
					'</div>' +
					'<div class="mbox-toolbar-right">' +
						'<span class="mbox-label">' + _('Config path:') + ' <span data-role="config-path"></span></span>' +
					'</div>' +
				'</div>' +

				'<div class="mbox-main">' +
					'<div class="mbox-tabs">' +
						'<button type="button" class="mbox-tab active" data-role="tab" data-tab="config">' + _('Configuration') + '</button>' +
						'<button type="button" class="mbox-tab" data-role="tab" data-tab="selectors">' + _('Selectors') + '</button>' +
						'<button type="button" class="mbox-tab" data-role="tab" data-tab="connections">' + _('Connections') + '</button>' +
						'<button type="button" class="mbox-tab" data-role="tab" data-tab="settings">' + _('Settings') + '</button>' +
					'</div>' +

					'<div class="mbox-panel active" data-role="panel" data-panel="config">' +
						'<div class="mbox-sub-wrap">' +
							'<div class="mbox-sub-row">' +
								'<input type="text" class="mbox-input" data-role="sub-url" placeholder="' + _('Subscription URL') + '">' +
								'<button type="button" data-role="sub-save" class="mbox-btn mbox-btn-primary">' + _('Save') + '</button>' +
								'<button type="button" data-role="sub-refresh" class="mbox-btn mbox-icon-btn" title="' + _('Update from subscription') + '">&#x21bb;</button>' +
								'<button type="button" data-role="sub-delete" class="mbox-btn mbox-icon-btn" title="' + _('Remove subscription') + '">&#x2715;</button>' +
								'<button type="button" data-role="sub-interval" class="mbox-btn"></button>' +
							'</div>' +
							'<div class="mbox-sub-status" data-role="sub-status"></div>' +
						'</div>' +
						'<div class="mbox-config-head">' +
							'<div class="mbox-mini-tabs">' +
								'<span class="mbox-mini-tab active">' + _('Config') + '</span>' +
								'<span class="mbox-mini-tab">' + _('Proxies') + '</span>' +
								'<span class="mbox-mini-tab">' + _('IP Exclude') + '</span>' +
								'<span class="mbox-mini-tab">' + _('Port Exclude') + '</span>' +
								'<span class="mbox-mini-tab">' + _('Port Proxying') + '</span>' +
							'</div>' +
						'</div>' +
						'<div class="mbox-config-wrap">' +
							'<div data-role="config-editor" class="mbox-editor"></div>' +
						'</div>' +
						'<div class="mbox-config-foot">' +
							'<div data-role="yaml-status" class="mbox-yaml-status">' + _('Checking YAML...') + '</div>' +
							'<div class="mbox-actions mbox-config-actions">' +
								'<button type="button" data-role="apply-config" class="mbox-btn mbox-btn-primary">' + _('Apply') + '</button>' +
								'<button type="button" data-role="save-config" class="mbox-btn">' + _('Save') + '</button>' +
								'<button type="button" data-role="format-config" class="mbox-btn">' + _('Format') + '</button>' +
							'</div>' +
						'</div>' +
					'</div>' +

					'<div class="mbox-panel" data-role="panel" data-panel="selectors">' +
						'<div class="mbox-panel-head">' +
							'<span class="mbox-label">' + _('Proxy selector groups from Mihomo API') + '</span>' +
							'<div class="mbox-panel-tools">' +
								'<button type="button" data-role="refresh-selectors" class="mbox-btn">' + _('Refresh selectors') + '</button>' +
							'</div>' +
						'</div>' +
						'<div data-role="selectors-body"></div>' +
					'</div>' +

					'<div class="mbox-panel" data-role="panel" data-panel="connections">' +
						'<div class="mbox-panel-head">' +
							'<span class="mbox-label">' + _('Live connections') + ': <span data-role="conn-total">0</span></span>' +
							'<div class="mbox-panel-tools">' +
								'<input type="text" data-role="conn-filter" class="mbox-input mbox-conn-filter" placeholder="' + _('Filter connections') + '">' +
								'<button type="button" data-role="close-all-connections" class="mbox-btn mbox-btn-danger">' + _('Close all') + '</button>' +
								'<button type="button" data-role="refresh-rule-sets" class="mbox-btn">' + _('Rule sets') + '</button>' +
								'<button type="button" data-role="refresh-proxy-sets" class="mbox-btn">' + _('Proxy sets') + '</button>' +
								'<button type="button" data-role="refresh-connections" class="mbox-btn">' + _('Refresh connections') + '</button>' +
							'</div>' +
						'</div>' +
						'<div data-role="connections-body"></div>' +
					'</div>' +

					'<div class="mbox-panel" data-role="panel" data-panel="settings">' +
						'<div class="mbox-settings-grid">' +
							'<div class="mbox-section">' +
								'<h3>' + _('Interface Processing Mode') + '</h3>' +
								'<div class="mbox-help">' + _('Choose how to handle network interfaces for proxy processing.') + '</div>' +
								'<div class="mbox-mode-grid">' +
									'<label class="mbox-mode-card" data-role="mode-card" data-mode="exclude">' +
										'<div class="mbox-mode-title"><input type="radio" name="iface-mode" value="exclude" data-role="iface-mode-radio"> &#9675; ' + _('Exclude Mode (Universal approach)') + '</div>' +
										'<div class="mbox-mode-desc">' + _('Process traffic from ALL interfaces except selected ones. Automatically detects and excludes WAN. Recommended for most users.') + '</div>' +
									'</label>' +
									'<label class="mbox-mode-card" data-role="mode-card" data-mode="explicit">' +
										'<div class="mbox-mode-title"><input type="radio" name="iface-mode" value="explicit" data-role="iface-mode-radio"> [!] ' + _('Explicit Mode (Precise control)') + '</div>' +
										'<div class="mbox-mode-desc">' + _('Process traffic ONLY from selected interfaces. More secure but requires manual configuration. Recommended for advanced users.') + '</div>' +
									'</label>' +
								'</div>' +
							'</div>' +

							'<div class="mbox-section">' +
								'<h3>' + _('Proxy Mode') + '</h3>' +
								'<div class="mbox-help">' + _('Choose how traffic is redirected to Clash: TPROXY (all traffic), TUN (all traffic via virtual interface), or MIXED (TCP via TPROXY, UDP via TUN - best for gaming).') + '</div>' +
								'<select class="mbox-select" data-role="proxy-mode-select">' +
									'<option value="tproxy">TPROXY</option>' +
									'<option value="tun">TUN</option>' +
									'<option value="mixed">MIXED</option>' +
								'</select>' +
								'<div class="mbox-proxy-desc" data-role="proxy-desc"></div>' +
								'<div class="mbox-switch" data-role="tun-stack-wrap">' +
									'<span>' + _('TUN stack') + '</span>' +
									'<select class="mbox-select" data-role="tun-stack-select">' +
										'<option value="system">system</option>' +
										'<option value="gvisor">gvisor</option>' +
										'<option value="mixed">mixed</option>' +
									'</select>' +
								'</div>' +
							'</div>' +

							'<div class="mbox-section">' +
								'<h3>' + _('Automatic Interface Detection') + '</h3>' +
								'<label class="mbox-switch" data-role="auto-wan-wrap"><input type="checkbox" data-role="auto-wan"> ' + _('Automatically detect WAN interface') + '</label>' +
								'<div class="mbox-help">' + _('When enabled, automatically detects and excludes WAN interface. Disable for manual interface exclusions.') + '</div>' +
								'<h3 style="margin-top:0.2rem" data-role="iface-title"></h3>' +
								'<div class="mbox-help" data-role="iface-desc"></div>' +
								'<div data-role="iface-list"></div>' +
							'</div>' +

							'<div class="mbox-section">' +
								'<h3>' + _('Additional Settings') + '</h3>' +
								'<label class="mbox-switch"><input type="checkbox" data-role="block-quic"> ' + _('Block QUIC traffic (UDP port 443)') + '</label>' +
								'<div class="mbox-help">' + _('When enabled, blocks QUIC traffic on UDP port 443. This can improve proxy effectiveness for services like YouTube.') + '</div>' +
								'<label class="mbox-switch"><input type="checkbox" data-role="tmpfs-rules"> ' + _('Store rules and proxy providers in RAM (tmpfs)') + '</label>' +
								'<div class="mbox-help">' + _('When enabled, rulesets and proxy-providers are stored in tmpfs for faster access (uses RAM).') + '</div>' +
								'<label class="mbox-switch"><input type="checkbox" data-role="enable-hwid"> ' + _('Add HWID headers to subscriptions') + '</label>' +
								'<div class="mbox-help">' + _('Automatically adds HWID headers to proxy-providers for device tracking (Remnawave compatibility).') + '</div>' +
								'<div class="mbox-actions" data-role="hwid-advanced" style="display:none;margin-top:0;">' +
									'<input class="mbox-input" data-role="hwid-user-agent" placeholder="User-Agent">' +
									'<input class="mbox-input" data-role="hwid-device-os" placeholder="Device OS">' +
								'</div>' +
							'</div>' +

							'<div class="mbox-section">' +
								'<div class="mbox-actions" style="margin-top:0;">' +
									'<button type="button" class="mbox-btn mbox-btn-primary" data-role="save-advanced">' + _('Save settings') + '</button>' +
									'<button type="button" class="mbox-btn" data-role="clear-advanced">' + _('Clear selection') + '</button>' +
									'<button type="button" class="mbox-btn" data-role="restart-advanced">' + _('Restart service') + '</button>' +
								'</div>' +
								'<div class="mbox-summary">' +
									'<div data-role="settings-summary"></div>' +
									'<div style="margin-top:0.3rem;color:var(--mb-good)" data-role="detect-summary"></div>' +
									'<div style="margin-top:0.3rem;color:var(--mb-warn)">&#9888; ' + _('Restart Clash service after saving changes') + '</div>' +
								'</div>' +
							'</div>' +

							'<div class="mbox-section">' +
								'<h3>' + _('Mihomo Kernel Management') + '</h3>' +
								'<div class="mbox-help">' + _('Download and manage the Mihomo (Clash Meta) kernel binary.') + '</div>' +
								'<div class="mbox-kernel" data-role="kernel-status"></div>' +
								'<div class="mbox-actions">' +
									'<button type="button" class="mbox-btn" data-role="kernel-reinstall">' + _('Reinstall kernel') + '</button>' +
									'<button type="button" class="mbox-btn" data-role="kernel-refresh">' + _('Refresh status') + '</button>' +
									'<button type="button" class="mbox-btn" data-role="kernel-restart">' + _('Restart service') + '</button>' +
								'</div>' +
							'</div>' +
						'</div>' +
					'</div>' +
				'</div>' +

				'<div class="mbox-logs">' +
					'<div class="mbox-logs-head">' +
						'<strong>' + _('Logs') + '</strong>' +
						'<div class="mbox-logs-tools">' +
							'<input type="text" data-role="log-filter" class="mbox-input" placeholder="' + _('Filter logs') + '">' +
							'<select data-role="log-source" class="mbox-select">' +
								'<option value="file">error.log</option>' +
								'<option value="system">logread</option>' +
							'</select>' +
							'<button type="button" data-role="refresh-logs" class="mbox-btn">' + _('Refresh logs') + '</button>' +
						'</div>' +
					'</div>' +
					'<pre data-role="log-pre" class="mbox-log-pre"></pre>' +
				'</div>' +
			'</div>';

		const store = {
			serviceName: state.serviceName || 'mibox-ui',
			running: !!state.running,
			mode: state.mode || 'tproxy',
			configPath: state.configPath || DEFAULT_CONFIG_PATH,
			logPath: state.logPath || DEFAULT_LOG_PATH,
			settingsPath: state.settingsPath || DEFAULT_SETTINGS_PATH,
			configText: state.configText || '',
			logs: state.logs || '',
			logSource: 'file',
			connFilter: '',
			selectors: state.selectors || { groups: [] },
			connections: state.connections || { total: 0, connections: [] },
			advancedSettings: state.advancedSettings || getDefaultAdvancedSettings(state.mode || 'tproxy'),
			interfaces: state.interfaces || [],
			kernel: state.kernel || { installed: false, version: '', path: '' },
			latestKernel: state.latestKernel || null,
			arch: state.arch || ''
		};

		const editorHost = root.querySelector('[data-role="config-editor"]');
		const yamlStatus = root.querySelector('[data-role="yaml-status"]');
		const configPathNode = root.querySelector('[data-role="config-path"]');
		const selectorsBody = root.querySelector('[data-role="selectors-body"]');
		const connectionsBody = root.querySelector('[data-role="connections-body"]');
		const connTotal = root.querySelector('[data-role="conn-total"]');
		const connFilterInput = root.querySelector('[data-role="conn-filter"]');
		const logFilter = root.querySelector('[data-role="log-filter"]');
		const logSource = root.querySelector('[data-role="log-source"]');
		const subUrlInput = root.querySelector('[data-role="sub-url"]');
		const kernelPill = root.querySelector('[data-role="kernel-pill"]');
		let editorApi = createTextareaEditor(editorHost, store.configText);
		let validateTimer = null;
		let validateToken = 0;

		function getEditorValue() {
			return editorApi ? editorApi.getValue() : '';
		}

		function setEditorValue(value) {
			if (editorApi)
				editorApi.setValue(value);
		}

		function setYamlValidationState(stateClass, message) {
			if (!yamlStatus)
				return;
			yamlStatus.className = 'mbox-yaml-status ' + (stateClass || '');
			yamlStatus.textContent = message || '';
		}

		async function validateYamlFromEditor() {
			const token = ++validateToken;
			setYamlValidationState('check', _('Checking YAML...'));

			const current = formatConfigText(getEditorValue() || '');
			await fs.write(TMP_VALIDATE_PATH, current);
			const result = await runConfigCheck(TMP_VALIDATE_PATH);

			if (token !== validateToken)
				return;

			if (result.ok) {
				setYamlValidationState('ok', _('YAML valid'));
			}
			else {
				const err = result.stderr || result.stdout || _('Validation failed');
				setYamlValidationState('err', _('YAML error: %s').format(err));
			}
		}

		function scheduleYamlValidation() {
			if (validateTimer)
				window.clearTimeout(validateTimer);
			validateTimer = window.setTimeout(function() {
				validateYamlFromEditor().catch(function() {
					setYamlValidationState('err', _('YAML error: %s').format('check failed'));
				});
			}, VALIDATE_DEBOUNCE_MS);
		}

		editorApi.onChange(scheduleYamlValidation);
		(async function() {
			try {
				const aceEditorApi = await createAceEditor(editorHost, store.configText);
				editorApi = aceEditorApi;
				editorApi.onChange(scheduleYamlValidation);
				scheduleYamlValidation();
			}
			catch (e) {
				setYamlValidationState('', _('Editor fallback mode'));
			}
		})();

		scheduleYamlValidation();
		configPathNode.textContent = store.configPath;
		renderSelectors(selectorsBody, store.selectors);
		renderConnections(connectionsBody, store.connections, store.connFilter);
		connTotal.textContent = String(store.connections.total || 0);
		renderStatus(root, store);
		renderLogs(root, store);
		store.advancedSettings.subscriptionUrl = String(store.advancedSettings.subscriptionUrl || '').trim();
		store.advancedSettings.subscriptionInterval = normalizeSubscriptionInterval(
			store.advancedSettings.subscriptionInterval,
			!!store.advancedSettings.subscriptionUrl
		);
		subUrlInput.value = store.advancedSettings.subscriptionUrl;
		if (connFilterInput)
			connFilterInput.value = store.connFilter;
		if (kernelPill)
			kernelPill.textContent = store.kernel && store.kernel.version ? store.kernel.version : '-';
		renderSubscriptionControls(root, store);

		store.mode = store.advancedSettings.proxyMode || store.mode;
		root.querySelector('[data-role="mode-select"]').value = store.mode;
		root.querySelector('[data-role="proxy-mode-select"]').value = store.advancedSettings.proxyMode;
		root.querySelector('[data-role="tun-stack-select"]').value = store.advancedSettings.tunStack;
		root.querySelector('[data-role="auto-wan"]').checked = !!store.advancedSettings.autoDetectWan;
		root.querySelector('[data-role="block-quic"]').checked = !!store.advancedSettings.blockQuic;
		root.querySelector('[data-role="tmpfs-rules"]').checked = !!store.advancedSettings.useTmpfsRules;
		root.querySelector('[data-role="enable-hwid"]').checked = !!store.advancedSettings.enableHwid;
		root.querySelector('[data-role="hwid-user-agent"]').value = store.advancedSettings.hwidUserAgent || 'MiboxUI';
		root.querySelector('[data-role="hwid-device-os"]').value = store.advancedSettings.hwidDeviceOS || 'OpenWrt';
		root.querySelector('[data-role="hwid-advanced"]').style.display = store.advancedSettings.enableHwid ? 'flex' : 'none';

		const modeRadios = root.querySelectorAll('[data-role="iface-mode-radio"]');
		for (let i = 0; i < modeRadios.length; i++) {
			modeRadios[i].checked = (modeRadios[i].value === store.advancedSettings.interfaceMode);
		}
		const modeCards = root.querySelectorAll('[data-role="mode-card"]');
		for (let i = 0; i < modeCards.length; i++) {
			modeCards[i].classList.toggle('active', modeCards[i].getAttribute('data-mode') === store.advancedSettings.interfaceMode);
		}

		renderProxyDesc(root, store.advancedSettings.proxyMode);
		root.querySelector('[data-role="auto-wan-wrap"]').style.display = store.advancedSettings.interfaceMode === 'exclude' ? 'flex' : 'none';
		renderInterfacesPanel(root, store);
		renderSettingsSummary(root, store);
		renderKernelSummary(root, store.kernel, store.latestKernel, store.arch);

		const tabs = root.querySelectorAll('[data-role="tab"]');
		for (let i = 0; i < tabs.length; i++) {
			tabs[i].addEventListener('click', function() {
				const nextTab = tabs[i].getAttribute('data-tab');
				setTab(root, nextTab);
				if (nextTab === 'config' && editorApi && editorApi.resize)
					window.setTimeout(function() { editorApi.resize(); }, 0);
			});
		}

		root.querySelector('[data-role="toggle-service"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				await fs.exec('/etc/init.d/' + store.serviceName, [ store.running ? 'stop' : 'start' ]);
				store.running = await getServiceRunning(store.serviceName);
				await setUci('enabled', store.running ? '1' : '0');
				renderStatus(root, store);
				ui.addNotification(null, E('p', store.running ? _('Service started') : _('Service stopped')), 'info');
			});
		});

		root.querySelector('[data-role="restart-service"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				await fs.exec('/etc/init.d/' + store.serviceName, [ 'restart' ]);
				store.running = await getServiceRunning(store.serviceName);
				renderStatus(root, store);
				ui.addNotification(null, E('p', _('Service restarted')), 'info');
			});
		});

		root.querySelector('[data-role="mode-select"]').addEventListener('change', async function(ev) {
			store.mode = ev.target.value || 'tproxy';
			store.advancedSettings.proxyMode = store.mode;
			root.querySelector('[data-role="proxy-mode-select"]').value = store.mode;
			renderProxyDesc(root, store.mode);
			await setUci('proxy_mode', store.mode);
			ui.addNotification(null, E('p', _('Routing mode changed: %s').format(store.mode.toUpperCase())), 'info');
		});

		root.querySelector('[data-role="refresh-all"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				store.running = await getServiceRunning(store.serviceName);
				store.selectors = await loadSelectors();
				store.connections = await loadConnections();
				store.logs = await readLogs(store.logPath, store.logSource);
				renderStatus(root, store);
				renderSelectors(selectorsBody, store.selectors);
				renderConnections(connectionsBody, store.connections, store.connFilter);
				connTotal.textContent = String(store.connections.total || 0);
				renderLogs(root, store);
			});
		});

		subUrlInput.addEventListener('input', function() {
			renderSubscriptionControls(root, store);
		});

		root.querySelector('[data-role="sub-save"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				const url = String(subUrlInput.value || '').replace(/[\r\n]/g, '').trim();
				if (!url || !/^https?:\/\//i.test(url)) {
					ui.addNotification(null, E('p', _('Please enter a valid http(s) subscription URL.')), 'error');
					return;
				}

				store.advancedSettings.subscriptionUrl = url;
				store.advancedSettings.subscriptionInterval = normalizeSubscriptionInterval(
					store.advancedSettings.subscriptionInterval,
					true
				);
				if (store.advancedSettings.subscriptionInterval === 'off')
					store.advancedSettings.subscriptionInterval = '2h';

				await saveAdvancedSettings(store.settingsPath, store.advancedSettings);
				const syncRes = await runSubscriptionAction('sync', store.settingsPath, store.configPath, store.serviceName, false);
				if (!syncRes.ok) {
					ui.addNotification(null, E('p', _('Failed to update subscription schedule: %s').format(syncRes.stderr || syncRes.stdout || 'unknown')), 'warning');
				}

				const updateRes = await runSubscriptionAction('update', store.settingsPath, store.configPath, store.serviceName, false);
				if (!updateRes.ok) {
					ui.addNotification(null, E('p', _('Subscription update failed: %s').format(updateRes.stderr || updateRes.stdout || 'unknown')), 'error');
					renderSubscriptionControls(root, store);
					return;
				}

				store.configText = await L.resolveDefault(fs.read(store.configPath), getEditorValue() || '');
				setEditorValue(store.configText);
				scheduleYamlValidation();
				store.running = await getServiceRunning(store.serviceName);
				renderStatus(root, store);
				renderSubscriptionControls(root, store);
				ui.addNotification(null, E('p', _('Subscription saved and config updated')), 'info');
			});
		});

		root.querySelector('[data-role="sub-refresh"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				if (!store.advancedSettings.subscriptionUrl) {
					ui.addNotification(null, E('p', _('Subscription is not configured.')), 'warning');
					return;
				}

				const updateRes = await runSubscriptionAction('update', store.settingsPath, store.configPath, store.serviceName, false);
				if (!updateRes.ok) {
					ui.addNotification(null, E('p', _('Subscription update failed: %s').format(updateRes.stderr || updateRes.stdout || 'unknown')), 'error');
					return;
				}

				store.configText = await L.resolveDefault(fs.read(store.configPath), getEditorValue() || '');
				setEditorValue(store.configText);
				scheduleYamlValidation();
				store.running = await getServiceRunning(store.serviceName);
				renderStatus(root, store);
				ui.addNotification(null, E('p', _('Config refreshed from subscription')), 'info');
			});
		});

		root.querySelector('[data-role="sub-delete"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				store.advancedSettings.subscriptionUrl = '';
				store.advancedSettings.subscriptionInterval = 'off';
				subUrlInput.value = '';
				await saveAdvancedSettings(store.settingsPath, store.advancedSettings);
				const syncRes = await runSubscriptionAction('sync', store.settingsPath, store.configPath, store.serviceName, false);
				if (!syncRes.ok) {
					ui.addNotification(null, E('p', _('Failed to remove subscription schedule: %s').format(syncRes.stderr || syncRes.stdout || 'unknown')), 'warning');
				}
				renderSubscriptionControls(root, store);
				ui.addNotification(null, E('p', _('Subscription removed')), 'info');
			});
		});

		root.querySelector('[data-role="sub-interval"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				if (!store.advancedSettings.subscriptionUrl) {
					ui.addNotification(null, E('p', _('Subscription is not configured.')), 'warning');
					return;
				}

				store.advancedSettings.subscriptionInterval = cycleSubscriptionInterval(store.advancedSettings.subscriptionInterval);
				await saveAdvancedSettings(store.settingsPath, store.advancedSettings);
				const syncRes = await runSubscriptionAction('sync', store.settingsPath, store.configPath, store.serviceName, false);
				if (!syncRes.ok) {
					ui.addNotification(null, E('p', _('Failed to update subscription schedule: %s').format(syncRes.stderr || syncRes.stdout || 'unknown')), 'warning');
				}

				renderSubscriptionControls(root, store);
				ui.addNotification(null, E('p', _('Auto update mode: %s').format(subscriptionIntervalText(store.advancedSettings.subscriptionInterval))), 'info');
			});
		});

		root.querySelector('[data-role="save-config"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				store.configText = formatConfigText(getEditorValue() || '');
				setEditorValue(store.configText);
				await fs.write(store.configPath, store.configText);
				await validateYamlFromEditor();
				ui.addNotification(null, E('p', _('Configuration saved')), 'info');
			});
		});

		root.querySelector('[data-role="format-config"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				try {
					store.configText = await formatYamlDeep(getEditorValue() || '');
					setEditorValue(store.configText);
					await validateYamlFromEditor();
					ui.addNotification(null, E('p', _('Configuration formatted')), 'info');
				}
				catch (e) {
					const msg = (e && e.message) ? e.message : 'unknown error';
					setYamlValidationState('err', _('YAML error: %s').format(msg));
					ui.addNotification(null, E('p', _('Deep format failed: %s').format(msg)), 'error');
				}
			});
		});

		root.querySelector('[data-role="apply-config"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				store.configText = formatConfigText(getEditorValue() || '');
				setEditorValue(store.configText);
				await fs.write(store.configPath, store.configText);
				const result = await runConfigCheck(store.configPath);
				if (!result.ok) {
					const err = result.stderr || result.stdout || _('Validation failed');
					setYamlValidationState('err', _('YAML error: %s').format(err));
					ui.addNotification(null, E('p', _('Validation error: %s').format(err)), 'error');
					return;
				}
				setYamlValidationState('ok', _('YAML valid'));
				const reloadResult = await reloadConfigSafely(store.serviceName);
				if (!reloadResult.ok) {
					ui.addNotification(null, E('p', _('Configuration saved, but Mihomo reload failed')), 'error');
					return;
				}
				store.running = await getServiceRunning(store.serviceName);
				renderStatus(root, store);
				ui.addNotification(null, E('p', _('Configuration applied and reloaded')), 'info');
			});
		});

		root.querySelector('[data-role="refresh-selectors"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				store.selectors = await loadSelectors();
				renderSelectors(selectorsBody, store.selectors);
			});
		});

		selectorsBody.addEventListener('click', function(ev) {
			const button = ev.target.closest('[data-role="selector-opt"]');
			if (!button || button.disabled)
				return;

			const group = String(button.getAttribute('data-group') || '');
			const target = String(button.getAttribute('data-option') || '');
			if (!group || !target)
				return;

			withBusy(button, async function() {
				const result = await switchSelector(group, target);
				if (!result.ok) {
					ui.addNotification(null, E('p', _('Failed to switch selector: %s').format(result.error || 'unknown')), 'error');
					return;
				}

				store.selectors = await loadSelectors();
				renderSelectors(selectorsBody, store.selectors);
				ui.addNotification(null, E('p', _('Selector switched: %s -> %s').format(group, target)), 'info');
			});
		});

		root.querySelector('[data-role="refresh-connections"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				store.connections = await loadConnections();
				renderConnections(connectionsBody, store.connections, store.connFilter);
				connTotal.textContent = String(store.connections.total || 0);
			});
		});

		if (connFilterInput) {
			connFilterInput.addEventListener('input', function(ev) {
				store.connFilter = String(ev.target.value || '');
				renderConnections(connectionsBody, store.connections, store.connFilter);
			});
		}

		root.querySelector('[data-role="close-all-connections"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				const result = await closeAllConnections();
				if (!result.ok) {
					ui.addNotification(null, E('p', _('Failed to close connections: %s').format(result.error || 'unknown')), 'error');
					return;
				}

				store.connections = await loadConnections();
				renderConnections(connectionsBody, store.connections, store.connFilter);
				connTotal.textContent = String(store.connections.total || 0);
				ui.addNotification(null, E('p', _('All connections closed')), 'info');
			});
		});

		connectionsBody.addEventListener('click', function(ev) {
			const button = ev.target.closest('[data-role="close-connection"]');
			if (!button)
				return;

			const connId = String(button.getAttribute('data-conn-id') || '');
			if (!connId)
				return;

			withBusy(button, async function() {
				const result = await closeConnection(connId);
				if (!result.ok) {
					ui.addNotification(null, E('p', _('Failed to close connection: %s').format(result.error || 'unknown')), 'error');
					return;
				}

				store.connections = await loadConnections();
				renderConnections(connectionsBody, store.connections, store.connFilter);
				connTotal.textContent = String(store.connections.total || 0);
			});
		});

		root.querySelector('[data-role="refresh-rule-sets"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				const r = await refreshProvidersApi();
				if (r.ok) {
					const updated = r.data && typeof r.data.updated === 'number' ? r.data.updated : 0;
					const failed = r.data && typeof r.data.failed === 'number' ? r.data.failed : 0;
					ui.addNotification(null, E('p', _('Providers refreshed (updated: %s, failed: %s)').format(updated, failed)), failed > 0 ? 'warning' : 'info');
				}
				else {
					ui.addNotification(null, E('p', _('Providers refresh failed: %s').format(r.error || r.raw || 'unknown')), 'error');
				}
			});
		});

		root.querySelector('[data-role="refresh-proxy-sets"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				const r = await refreshProvidersApi();
				if (r.ok) {
					const updated = r.data && typeof r.data.updated === 'number' ? r.data.updated : 0;
					const failed = r.data && typeof r.data.failed === 'number' ? r.data.failed : 0;
					ui.addNotification(null, E('p', _('Providers refreshed (updated: %s, failed: %s)').format(updated, failed)), failed > 0 ? 'warning' : 'info');
				}
				else {
					ui.addNotification(null, E('p', _('Providers refresh failed: %s').format(r.error || r.raw || 'unknown')), 'error');
				}
			});
		});

		root.querySelector('[data-role="refresh-logs"]').addEventListener('click', function(ev) {
			const button = ev.currentTarget;
			withBusy(button, async function() {
				store.logs = await readLogs(store.logPath, store.logSource);
				renderLogs(root, store);
			});
		});

		logFilter.addEventListener('input', function() {
			renderLogs(root, store);
		});

		logSource.addEventListener('change', async function(ev) {
			store.logSource = ev.target.value || 'file';
			store.logs = await readLogs(store.logPath, store.logSource);
			renderLogs(root, store);
		});

		for (let i = 0; i < modeRadios.length; i++) {
			modeRadios[i].addEventListener('change', function(ev) {
				store.advancedSettings.interfaceMode = ev.target.value || 'exclude';
				for (let j = 0; j < modeCards.length; j++) {
					modeCards[j].classList.toggle('active', modeCards[j].getAttribute('data-mode') === store.advancedSettings.interfaceMode);
				}
				root.querySelector('[data-role="auto-wan-wrap"]').style.display = store.advancedSettings.interfaceMode === 'exclude' ? 'flex' : 'none';
				renderInterfacesPanel(root, store);
				renderSettingsSummary(root, store);
			});
		}

		root.querySelector('[data-role="proxy-mode-select"]').addEventListener('change', function(ev) {
			store.advancedSettings.proxyMode = ev.target.value || 'tproxy';
			store.mode = store.advancedSettings.proxyMode;
			root.querySelector('[data-role="mode-select"]').value = store.mode;
			renderProxyDesc(root, store.mode);
		});

		root.querySelector('[data-role="tun-stack-select"]').addEventListener('change', function(ev) {
			store.advancedSettings.tunStack = ev.target.value || 'system';
		});

		root.querySelector('[data-role="auto-wan"]').addEventListener('change', async function(ev) {
			store.advancedSettings.autoDetectWan = !!ev.target.checked;
			if (store.advancedSettings.autoDetectWan)
				store.advancedSettings.detectedWan = await detectWanInterface();
			else
				store.advancedSettings.detectedWan = '';
			renderInterfacesPanel(root, store);
			renderSettingsSummary(root, store);
		});

		root.querySelector('[data-role="enable-hwid"]').addEventListener('change', function(ev) {
			store.advancedSettings.enableHwid = !!ev.target.checked;
			root.querySelector('[data-role="hwid-advanced"]').style.display = store.advancedSettings.enableHwid ? 'flex' : 'none';
		});

		root.querySelector('[data-role="clear-advanced"]').addEventListener('click', function() {
			const checks = root.querySelectorAll('[data-role="iface-check"]');
			for (let i = 0; i < checks.length; i++) {
				checks[i].checked = false;
				const label = checks[i].closest('.mbox-iface-label');
				if (label)
					label.classList.remove('checked');
			}
			renderSettingsSummary(root, store);
		});

		root.querySelector('[data-role="restart-advanced"]').addEventListener('click', function(ev) {
			withBusy(ev.currentTarget, async function() {
				await fs.exec('/etc/init.d/' + store.serviceName, [ 'restart' ]);
				store.running = await getServiceRunning(store.serviceName);
				renderStatus(root, store);
				ui.addNotification(null, E('p', _('Service restarted')), 'info');
			});
		});

		root.querySelector('[data-role="save-advanced"]').addEventListener('click', function(ev) {
			withBusy(ev.currentTarget, async function() {
				store.advancedSettings.interfaceMode = (root.querySelector('[data-role="iface-mode-radio"]:checked') || { value: 'exclude' }).value;
				store.advancedSettings.proxyMode = root.querySelector('[data-role="proxy-mode-select"]').value || 'tproxy';
				store.advancedSettings.tunStack = root.querySelector('[data-role="tun-stack-select"]').value || 'system';
				store.advancedSettings.autoDetectWan = !!root.querySelector('[data-role="auto-wan"]').checked;
				store.advancedSettings.blockQuic = !!root.querySelector('[data-role="block-quic"]').checked;
				store.advancedSettings.useTmpfsRules = !!root.querySelector('[data-role="tmpfs-rules"]').checked;
				store.advancedSettings.enableHwid = !!root.querySelector('[data-role="enable-hwid"]').checked;
				store.advancedSettings.hwidUserAgent = root.querySelector('[data-role="hwid-user-agent"]').value || 'MiboxUI';
				store.advancedSettings.hwidDeviceOS = root.querySelector('[data-role="hwid-device-os"]').value || 'OpenWrt';

				if (store.advancedSettings.autoDetectWan)
					store.advancedSettings.detectedWan = await detectWanInterface();
				else
					store.advancedSettings.detectedWan = '';

				const manual = readManualSelection(root, store.advancedSettings);
				if (store.advancedSettings.interfaceMode === 'explicit') {
					store.advancedSettings.includedInterfaces = manual;
					store.advancedSettings.excludedInterfaces = [];
				}
				else {
					store.advancedSettings.excludedInterfaces = manual;
					store.advancedSettings.includedInterfaces = [];
				}

				await saveAdvancedSettings(store.settingsPath, store.advancedSettings);
				await setUci('proxy_mode', store.advancedSettings.proxyMode);
				await setUci('tun_stack', store.advancedSettings.tunStack);

				let updatedConfig = transformProxyMode(String(getEditorValue() || ''), store.advancedSettings.proxyMode, store.advancedSettings.tunStack);
				if (store.advancedSettings.enableHwid) {
					const hw = await getHwidValues();
					updatedConfig = addHwidToYaml(
						updatedConfig,
						store.advancedSettings.hwidUserAgent,
						store.advancedSettings.hwidDeviceOS,
						hw.hwid,
						hw.verOs,
						hw.deviceModel
					);
				}

				store.mode = store.advancedSettings.proxyMode;
				root.querySelector('[data-role="mode-select"]').value = store.mode;
				setEditorValue(updatedConfig);
				store.configText = updatedConfig;
				await fs.write(store.configPath, updatedConfig.replace(/\r\n/g, '\n').replace(/\n?$/, '\n'));
				scheduleYamlValidation();

				const applyResult = await L.resolveDefault(fs.exec('/usr/bin/mibox-ui/mibox-ui-apply-settings', [ store.settingsPath ]), null);
				if (applyResult && applyResult.code !== 0) {
					ui.addNotification(null, E('p', _('Failed to apply runtime settings: %s').format(String(applyResult.stderr || applyResult.stdout || applyResult.code))), 'warning');
				}
				else {
					ui.addNotification(null, E('p', _('Runtime settings applied')), 'info');
				}

				renderProxyDesc(root, store.mode);
				renderInterfacesPanel(root, store);
				renderSettingsSummary(root, store);
				ui.addNotification(null, E('p', _('Settings saved. Please restart the Clash service for changes to take effect.')), 'info');
			});
		});

		root.querySelector('[data-role="kernel-refresh"]').addEventListener('click', function(ev) {
			withBusy(ev.currentTarget, async function() {
				store.kernel = await getKernelStatus();
				store.arch = await detectSystemArchitecture();
				store.latestKernel = await getLatestMihomoRelease();
				renderKernelSummary(root, store.kernel, store.latestKernel, store.arch);
				if (kernelPill)
					kernelPill.textContent = store.kernel && store.kernel.version ? store.kernel.version : '-';
			});
		});

		root.querySelector('[data-role="kernel-restart"]').addEventListener('click', function(ev) {
			withBusy(ev.currentTarget, async function() {
				await fs.exec('/etc/init.d/' + store.serviceName, [ 'restart' ]);
				store.running = await getServiceRunning(store.serviceName);
				renderStatus(root, store);
				ui.addNotification(null, E('p', _('Service restarted')), 'info');
			});
		});

		root.querySelector('[data-role="kernel-reinstall"]').addEventListener('click', function(ev) {
			withBusy(ev.currentTarget, async function() {
				store.latestKernel = await getLatestMihomoRelease();
				store.arch = await detectSystemArchitecture();
				if (!store.latestKernel || !store.latestKernel.version) {
					ui.addNotification(null, E('p', _('Failed to check latest version')), 'error');
					return;
				}

				const fileName = `mihomo-linux-${store.arch}-${store.latestKernel.version}.gz`;
				const asset = (store.latestKernel.assets || []).find(a => a.name === fileName);
				if (!asset) {
					ui.addNotification(null, E('p', _('No binary found for architecture: %s').format(store.arch)), 'error');
					return;
				}

				try {
					await installKernel(asset.browser_download_url, store.latestKernel.version, store.arch, store.kernel.path || KERNEL_BIN_PRIMARY);
					ui.addNotification(null, E('p', _('Mihomo kernel downloaded and installed successfully!')), 'info');
				}
				catch (e) {
					ui.addNotification(null, E('p', _('Failed to download mihomo kernel: %s').format(e.message || String(e))), 'error');
				}

				store.kernel = await getKernelStatus();
				renderKernelSummary(root, store.kernel, store.latestKernel, store.arch);
				if (kernelPill)
					kernelPill.textContent = store.kernel && store.kernel.version ? store.kernel.version : '-';
			});
		});

		poll.add(async function() {
			store.running = await getServiceRunning(store.serviceName);
			renderStatus(root, store);

			const activeTab = root.querySelector('[data-role="tab"].active');
			const tab = activeTab ? activeTab.getAttribute('data-tab') : 'config';

			if (tab === 'selectors') {
				store.selectors = await loadSelectors();
				renderSelectors(selectorsBody, store.selectors);
			}
			else if (tab === 'connections') {
				store.connections = await loadConnections();
				renderConnections(connectionsBody, store.connections, store.connFilter);
				connTotal.textContent = String(store.connections.total || 0);
			}

			store.logs = await readLogs(store.logPath, store.logSource);
			renderLogs(root, store);
		}, 6);

		return root;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
