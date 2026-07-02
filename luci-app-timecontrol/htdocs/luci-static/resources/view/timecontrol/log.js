// SPDX-License-Identifier: Apache-2.0
/*
 * Copyright (C) 2022-2026 sirpdboy <herboy2008@gmail.com>
 * 增强：日志过滤模式（显示全部 / 仅显示允许时段日志）
 * 优化：丢弃无 MAC 且无关键事件的空块，彻底清除无意义日志
 */
'use strict';
'require dom';
'require fs';
'require poll';
'require uci';
'require view';
'require form';

return view.extend({
	render: function () {
		var css = `
			#log_textarea pre {
				padding: 10px;
				border-bottom: 1px solid #ddd;
				font-size: small;
				line-height: 1.3;
				white-space: pre-wrap;
				word-wrap: break-word;
				overflow-y: auto;
			}
			.cbi-section small {
				margin-left: 1rem;
				font-size: small;
			}
			.log-container {
				display: flex;
				flex-direction: column;
				max-height: 1200px;
				overflow-y: auto;
				border-radius: 3px;
				margin-top: 10px;
				padding: 5px;
			}
			.log-line {
				padding: 3px 0;
				font-family: monospace;
				font-size: 12px;
				line-height: 1.4;
				border-bottom: 1px solid #f0f0f0;
			}
			.log-line:last-child {
				border-bottom: none;
			}
			.log-timestamp {
				margin-right: 10px;
				color: #888;
			}
			.log-allow {
				color: #2e7d32;
			}
			.log-block {
				color: #c62828;
			}
			.log-other {
				color: #333;
			}
			.tc-log-filter {
				display: flex;
				align-items: center;
				gap: 10px;
				margin-bottom: 10px;
				flex-wrap: wrap;
			}
			.tc-log-filter label {
				font-weight: bold;
			}
		`;

		var log_path = '/var/log/timecontrol.log';
		var lastLogContent = '';
		var lastScrollTop = 0;
		var isScrolledToTop = true;
		var currentFilterMode = 'all'; // 'all' 或 'allow_only'

		// ---------- 检查行是否包含 MAC 地址 ----------
		function containsMAC(line) {
			return /([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/.test(line);
		}

		// ---------- 检查行是否包含关键事件 ----------
		function containsKeyEvent(line) {
			var keywords = ['阻止上网', '超时', 'ALLOW_ACCESS', 'BLOCK_ACCESS', 'TIME_EXCEEDED'];
			for (var i = 0; i < keywords.length; i++) {
				if (line.indexOf(keywords[i]) !== -1) {
					return true;
				}
			}
			return false;
		}

		// ---------- 过滤函数（丢弃无 MAC 且无事件的行/块） ----------
		function filterLogByMode(logContent, mode) {
			if (mode === 'all' || !logContent) {
				// 全部模式：只去除空行
				return logContent.split('\n').filter(function(line) {
					return line.trim() !== '';
				}).join('\n');
			}

			// 模式：仅显示允许时段日志
			var lines = logContent.split('\n');
			var blocks = [];
			var currentBlock = [];
			var inBlock = false;

			// 按 "新一轮检查" 分割块
			for (var i = 0; i < lines.length; i++) {
				var line = lines[i];
				if (line.indexOf('========== 新一轮检查 ==========') !== -1) {
					if (currentBlock.length > 0) {
						blocks.push(currentBlock);
						currentBlock = [];
					}
					currentBlock.push(line);
					inBlock = true;
				} else if (inBlock) {
					currentBlock.push(line);
				}
			}
			if (currentBlock.length > 0) {
				blocks.push(currentBlock);
			}

			var filteredBlocks = [];

			blocks.forEach(function(blockLines) {
				// 1. 提取该块中所有 "不在任何时段" 的 MAC
				var notInPeriodMACs = [];
				blockLines.forEach(function(line) {
					var match = line.match(/不在任何时段:\s*([0-9A-Fa-f:]+)/);
					if (match) {
						notInPeriodMACs.push(match[1].trim());
					}
				});

				// 2. 先过滤掉这些 MAC 的行（如果存在）
				var filteredLines = blockLines;
				if (notInPeriodMACs.length > 0) {
					filteredLines = blockLines.filter(function(line) {
						var shouldKeep = true;
						notInPeriodMACs.forEach(function(mac) {
							if (line.indexOf(mac) !== -1) {
								shouldKeep = false;
							}
						});
						return shouldKeep;
					});
				}

				// 3. 检查过滤后的块是否还有有效内容：
				//    - 包含 MAC 地址，或
				//    - 包含关键事件（阻止、超时等）
				var hasUsefulContent = filteredLines.some(function(line) {
					// 跳过标题行本身
					if (line.indexOf('========== 新一轮检查 ==========') !== -1) return false;
					return containsMAC(line) || containsKeyEvent(line);
				});

				// 4. 如果有用，则保留该块（但保留标题行和有用行）
				if (hasUsefulContent) {
					// 保留标题行
					var headerLine = blockLines.find(function(line) {
						return line.indexOf('========== 新一轮检查 ==========') !== -1;
					});
					var resultLines = [];
					if (headerLine) resultLines.push(headerLine);
					// 加上过滤后的有用行（去除空行）
					filteredLines.forEach(function(line) {
						if (line.trim() !== '' && line.indexOf('========== 新一轮检查 ==========') === -1) {
							resultLines.push(line);
						}
					});
					filteredBlocks.push(resultLines);
				}
			});

			// 合并所有块，彻底去除空行
			var resultLines = [];
			filteredBlocks.forEach(function(blockLines) {
				blockLines.forEach(function(line) {
					if (line.trim() !== '') {
						resultLines.push(line);
					}
				});
			});

			if (resultLines.length === 0) {
				return '';
			}
			return resultLines.join('\n');
		}

		// 解析日志行的时间戳，用于排序
		function parseLogTimestamp(logLine) {
			var timestampMatch = logLine.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
			if (timestampMatch) {
				return new Date(timestampMatch[1]).getTime();
			}
			return Date.now();
		}

		function reverseLogLines(logContent) {
			if (!logContent || logContent.trim() === '') {
				return logContent;
			}
			var lines = logContent.split('\n');
			lines = lines.filter(function(line) {
				return line.trim() !== '';
			});
			lines.sort(function(a, b) {
				var timeA = parseLogTimestamp(a);
				var timeB = parseLogTimestamp(b);
				return timeB - timeA; // 降序（最新在上）
			});
			return lines.join('\n');
		}

		function formatLogLines(logContent, isNewContent) {
			if (!logContent || logContent.trim() === '') {
				return E('div', { 'class': 'log-line' }, _('日志为空'));
			}
			var lines = logContent.split('\n');
			var formattedLines = [];
			for (var i = 0; i < lines.length; i++) {
				var line = lines[i].trim();
				if (line === '') continue;
				var timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
				var timestampSpan = null;
				var messageSpan = null;
				var lineClass = 'log-line log-other';
				if (line.indexOf('阻止上网') !== -1 || line.indexOf('BLOCK') !== -1) {
					lineClass = 'log-line log-block';
				} else if (line.indexOf('允许上网') !== -1 || line.indexOf('ALLOW') !== -1) {
					lineClass = 'log-line log-allow';
				}
				if (timestampMatch) {
					timestampSpan = E('span', { 'class': 'log-timestamp', 'title': timestampMatch[1] }, timestampMatch[0] + ' ');
					messageSpan = E('span', {}, line.substring(timestampMatch[0].length + 1));
				} else {
					messageSpan = E('span', {}, line);
				}
				var lineDiv = E('div', { 'class': lineClass }, [
					timestampSpan,
					messageSpan
				].filter(function(el) { return el !== null; }));
				formattedLines.push(lineDiv);
			}
			return E('div', {}, formattedLines);
		}

		// 构建过滤下拉框
		var filterSelect = E('select', { id: 'log-filter-select' }, [
			E('option', { value: 'all' }, _('显示全部日志')),
			E('option', { value: 'allow_only' }, _('仅显示允许时段日志'))
		]);

		var filterGroup = E('div', { 'class': 'tc-log-filter' }, [
			E('label', {}, _('日志过滤:')),
			filterSelect
		]);

		// 日志容器
		var log_container = E('div', { 'class': 'log-container', 'id': 'log_container' },
			E('span', { 'class': 'spinning', 'style': 'display:inline-block;vertical-align:middle;margin-right:8px;' }, ' '),
			_('加载日志...')
		);

		// 清空按钮
		var clearBtn = E('button', {
			'class': 'cbi-button cbi-button-remove',
			'click': function (ev) {
				ev.preventDefault();
				var button = ev.target;
				button.disabled = true;
				button.textContent = _('清空中...');
				fs.exec_direct('/usr/libexec/timecontrol-call', ['clear_log'])
					.then(function () {
						button.textContent = _('清空成功');
						button.disabled = false;
						button.textContent = _('清空日志');
						var logContent = _('日志为空');
						lastLogContent = logContent;
						dom.content(log_container, formatLogLines(logContent, false));
						isScrolledToTop = true;
						log_container.scrollTop = 0;
					})
					.catch(function () {
						button.textContent = _('清空失败');
						button.disabled = false;
						button.textContent = _('清空日志');
					});
			}
		}, _('清空日志'));

		// 过滤切换事件
		filterSelect.addEventListener('change', function() {
			currentFilterMode = this.value;
			if (lastLogContent) {
				var filtered = filterLogByMode(lastLogContent, currentFilterMode);
				var reversed = reverseLogLines(filtered);
				var formatted = formatLogLines(reversed, false);
				dom.content(log_container, formatted);
				log_container.scrollTop = 0;
				isScrolledToTop = true;
			}
		});

		// 滚动事件
		log_container.addEventListener('scroll', function() {
			lastScrollTop = this.scrollTop;
			isScrolledToTop = this.scrollTop <= 1;
		});

		// 轮询更新日志（带过滤）
		poll.add(L.bind(function () {
			return fs.read_direct(log_path, 'text')
				.then(function (res) {
					var rawLog = res.trim();
					if (rawLog === '') {
						rawLog = _('日志为空');
					}
					var filteredLog = filterLogByMode(rawLog, currentFilterMode);
					if (filteredLog !== lastLogContent) {
						var isNewContent = lastLogContent !== '' && lastLogContent !== _('日志为空');
						var reversed = reverseLogLines(filteredLog);
						var formatted = formatLogLines(reversed, isNewContent);
						var prevScrollHeight = log_container.scrollHeight;
						var prevScrollTop = log_container.scrollTop;
						dom.content(log_container, formatted);
						lastLogContent = filteredLog;
						if (isScrolledToTop || isNewContent) {
							log_container.scrollTop = 0;
						} else {
							var newScrollHeight = log_container.scrollHeight;
							var heightDiff = newScrollHeight - prevScrollHeight;
							log_container.scrollTop = prevScrollTop + heightDiff;
						}
					}
				}).catch(function (err) {
					var logContent;
					if (err.toString().includes('NotFoundError')) {
						logContent = _('日志文件不存在');
					} else {
						logContent = _('读取错误: %s').format(err);
					}
					if (logContent !== lastLogContent) {
						var filtered = filterLogByMode(logContent, currentFilterMode);
						dom.content(log_container, formatLogLines(filtered, false));
						lastLogContent = filtered;
					}
				});
		}));

		poll.start();

		return E('div', { 'class': 'cbi-map' }, [
			E('style', [css]),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;' }, [
					filterGroup,
					clearBtn
				]),
				log_container,
				E('small', {}, _('刷新间隔 5 秒'))
			]),
			E('div', { 'style': 'text-align: right; font-style: italic;' }, [
				E('span', {}, [
					_('© github '),
					E('a', {
						'href': 'https://github.com/sirpdboy',
						'target': '_blank',
						'style': 'text-decoration: none;'
					}, 'by sirpdboy')
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
