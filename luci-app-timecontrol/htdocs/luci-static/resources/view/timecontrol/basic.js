// SPDX-License-Identifier: Apache-2.0
/*
 * 上网时间控制 - 修复版 v3.4.1
 * 修复多时段默认值问题；调整布局；更新描述；阈值默认300KB
 */
'use strict';
'require view';
'require fs';
'require ui';
'require uci';
'require form';
'require poll';
'require rpc';
'require network';

const VERSION = "v3.4.1";
const NOTIFY_TIMEOUT = 5000;

function debugLog(msg, obj) {
    if (window.console) {
        if (obj !== undefined) console.log('[TimeControl][' + VERSION + ']', msg, obj);
        else console.log('[TimeControl][' + VERSION + ']', msg);
    }
}

function showTip(msg, type) {
    type = type || 'info';
    ui.addNotification(null, E('p', msg), type, NOTIFY_TIMEOUT);
}

function uciCommitConfig() {
    debugLog('执行系统命令: uci commit timecontrol');
    return fs.exec_direct('/sbin/uci', ['commit', 'timecontrol'])
        .then(function(res) {
            debugLog('uci commit 执行成功', res);
            return true;
        })
        .catch(function(err) {
            console.error('[TimeControl] uci commit 执行失败:', err);
            throw new Error('写入配置文件失败: ' + (err.message || err));
        });
}

// ===== 全局样式 =====
(function injectStyles() {
    var styleId = 'timecontrol-style-' + VERSION;
    if (document.getElementById(styleId)) return;
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .tc-container { padding: 10px; font-size: 16px; }
        .tc-table-wrap { overflow-x: auto; max-width: 100%; }
        .tc-table { width: 100%; border-collapse: collapse; font-size: 15px; }
        .tc-table th { background: #f0f0f0; padding: 10px 8px; text-align: left; white-space: nowrap; border-bottom: 2px solid #ccc; font-size: 15px; }
        .tc-table td { padding: 8px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; font-size: 15px; }
        .tc-table tr:hover { background: #f9f9f9; }
        /* ★★★ 修改点1：备注列内容居中 ★★★ */
        .tc-table .comment-cell { max-width: 160px; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-align: center; }
        .tc-table .mac-cell { min-width: 170px; }
        .tc-table .mode-cell { min-width: 120px; }
        .tc-table .duration-cell { min-width: 110px; }
        .tc-table .usage-cell { min-width: 120px; font-weight: bold; }
        .tc-table .period-detail-cell { min-width: 200px; max-width: 250px; word-break: break-word; }
        .tc-table .actions-cell { white-space: nowrap; min-width: 220px; }
        .tc-btn { margin: 0 3px; padding: 5px 10px; border-radius: 3px; border: 1px solid #aaa; background: #fff; cursor: pointer; font-size: 14px; }
        .tc-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .tc-btn:hover { background: #eee; }
        .tc-btn-reset { background: #f0ad4e; border-color: #eea236; color: #fff; }
        .tc-btn-reset:hover { background: #ec971f; }
        .tc-btn-del { background: #d9534f; border-color: #d43f3a; color: #fff; }
        .tc-btn-del:hover { background: #c9302c; }
        .tc-btn-edit { background: #5bc0de; border-color: #46b8da; color: #fff; }
        .tc-btn-edit:hover { background: #31b0d5; }
        .tc-btn-add { background: #5cb85c; border-color: #4cae4c; color: #fff; padding: 6px 18px; font-size: 15px; }
        .tc-btn-add:hover { background: #449d44; }
        .tc-btn-save { background: #337ab7; border-color: #2e6da4; color: #fff; }
        .tc-btn-save:hover { background: #286090; }
        .tc-btn-cancel { background: #777; border-color: #666; color: #fff; }
        .tc-btn-cancel:hover { background: #555; }
        .tc-status { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 16px; }
        .tc-empty { color: #999; font-style: italic; text-align: center; padding: 20px; font-size: 15px; }
        .tc-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center; }
        .tc-modal { background: #fff; border-radius: 6px; padding: 20px; max-width: 750px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .tc-modal h3 { margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 18px; }
        .tc-modal .form-group { display: flex; flex-wrap: wrap; margin-bottom: 10px; align-items: center; }
        .tc-modal .form-group label { width: 120px; font-weight: bold; font-size: 15px; }
        .tc-modal .form-group input, .tc-modal .form-group select { flex: 1; padding: 5px 10px; border-radius: 3px; border: 1px solid #ccc; min-width: 150px; font-size: 15px; }
        .tc-modal .form-group .field-group { display: flex; flex-wrap: wrap; gap: 10px; flex: 1; }
        .tc-modal .form-group .field-group input { flex: 1; min-width: 80px; }
        .tc-modal .form-actions { margin-top: 15px; text-align: right; }
        .tc-modal .form-actions button { margin-left: 8px; font-size: 15px; }
        .tc-modal .period-group { border-left: 3px solid #5bc0de; padding-left: 10px; margin: 5px 0 10px 0; }
        .tc-modal .period-group label { width: 80px; }
        .tc-modal .help-text { font-size: 14px; color: #666; margin: 4px 0 8px 0; padding-left: 120px; }
        .tc-hidden { display: none !important; }
        .tc-add-bar { margin: 10px 0; text-align: right; }
        .tc-global-settings { background: #f9f9f9; padding: 12px; border-radius: 4px; margin: 10px 0; display: flex; flex-wrap: wrap; gap: 20px; align-items: center; }
        .tc-global-settings label { font-weight: bold; margin-right: 6px; font-size: 15px; }
        .tc-global-settings select { padding: 5px 10px; border-radius: 3px; border: 1px solid #ccc; font-size: 15px; }
        .tc-device-select { display: flex; gap: 8px; flex: 1; }
        .tc-device-select select { flex: 1; }
        .tc-device-select input { flex: 2; }
        #version-tip { background: #e7f3ff; padding: 10px; border: 1px solid #b3d8ff; border-radius: 4px; margin-bottom: 10px; font-size: 15px; }
        #version-tip strong { color: #0066cc; font-size: 16px; }
        #version-tip small { color: #333; font-size: 14px; }
        .traffic-settings { margin-top: 15px; border-top: 1px solid #ddd; padding-top: 15px; }
        .traffic-settings label { margin-right: 8px; }
        .traffic-settings input[type="number"] { width: 70px; margin-right: 15px; }
        .traffic-settings .btn-save-traffic { margin-top: 10px; }
        .traffic-settings .hint { font-size: 12px; color: #666; margin-top: 5px; }
        .btn-restart { margin-top: 10px; }
    `;
    document.head.appendChild(style);
    debugLog('全局样式注入完成');
})();

// ===== 工具函数 =====
function getDeviceList() {
    var devices = [];
    uci.sections('timecontrol', 'device', function(s) {
        devices.push(s);
    });
    return devices;
}

function getDeviceById(id) {
    var dev = null;
    uci.sections('timecontrol', 'device', function(s) {
        if (s['.name'] === id) {
            dev = s;
        }
    });
    return dev;
}

function saveDevice(section, data) {
    debugLog('开始保存设备配置, section=' + (section || '新建'));
    return uci.load('timecontrol').then(function() {
        var targetSection = section;
        if (!targetSection) {
            targetSection = uci.add('timecontrol', 'device');
            debugLog('创建设备新节: ' + targetSection);
        }
        Object.keys(data).forEach(function(key) {
            if (data[key] !== undefined && data[key] !== null) {
                uci.set('timecontrol', targetSection, key, data[key]);
            }
        });
        return uci.save('timecontrol');
    }).then(function() {
        debugLog('UCI缓存保存成功，开始写入配置文件');
        return uciCommitConfig();
    }).then(function() {
        debugLog('设备配置已成功写入文件');
        return true;
    }).catch(function(err) {
        console.error('[TimeControl] 保存设备失败:', err);
        throw err;
    });
}

function deleteDevice(section) {
    debugLog('开始删除设备节: ' + section);
    if (!section) {
        showTip(_('删除失败：设备标识无效'), 'error');
        return Promise.reject(new Error('section is empty'));
    }
    return uci.load('timecontrol').then(function() {
        var exists = false;
        uci.sections('timecontrol', 'device', function(s) {
            if (s['.name'] === section) exists = true;
        });
        if (!exists) {
            throw new Error('设备配置节不存在');
        }
        if (typeof uci.delete === 'function') {
            uci.delete('timecontrol', section);
        } else if (typeof uci.remove === 'function') {
            uci.remove('timecontrol', section);
        } else {
            uci.set('timecontrol', section, null);
        }
        debugLog('内存中已标记删除，保存缓存');
        return uci.save('timecontrol');
    }).then(function() {
        debugLog('缓存保存成功，提交到配置文件');
        return uciCommitConfig();
    }).then(function() {
        debugLog('删除已写入配置文件');
        showTip(_('删除成功'), 'info');
        return true;
    }).catch(function(err) {
        console.error('[TimeControl] 删除失败:', err);
        showTip(_('删除失败：') + err.message, 'error');
        throw err;
    });
}

function ensureGlobalSection() {
    return fs.exec_direct('/sbin/uci', ['get', 'timecontrol.timecontrol'])
        .then(function() {
            debugLog('全局配置节 timecontrol 已存在');
            return true;
        })
        .catch(function() {
            debugLog('全局配置节不存在，创建默认配置');
            return fs.exec_direct('/sbin/uci', ['set', 'timecontrol.timecontrol=timecontrol'])
                .then(function() {
                    return fs.exec_direct('/sbin/uci', ['set', 'timecontrol.timecontrol.list_type=blacklist']);
                })
                .then(function() {
                    return fs.exec_direct('/sbin/uci', ['set', 'timecontrol.timecontrol.chain=forward']);
                })
                .then(function() {
                    // ★★★ 修改点2：流量感知阈值默认改为300 ★★★
                    return fs.exec_direct('/sbin/uci', ['set', 'timecontrol.timecontrol.traffic_aware_enabled=0']);
                })
                .then(function() {
                    return fs.exec_direct('/sbin/uci', ['set', 'timecontrol.timecontrol.traffic_threshold=300']);
                })
                .then(function() {
                    return fs.exec_direct('/sbin/uci', ['set', 'timecontrol.timecontrol.traffic_consecutive=3']);
                })
                .then(function() {
                    return fs.exec_direct('/sbin/uci', ['set', 'timecontrol.timecontrol.traffic_poll_interval=30']);
                })
                .then(function() {
                    return fs.exec_direct('/sbin/uci', ['commit', 'timecontrol']);
                })
                .then(function() {
                    debugLog('全局配置节初始化完成（含流量感知默认值）');
                    return true;
                });
        });
}

function getGlobalSetting(key, def) {
    var val = uci.get('timecontrol', 'timecontrol', key);
    if (val !== undefined && val !== null) {
        val = val.trim();
        if (val === '') {
            return def;
        }
        return val;
    }
    return def;
}

function setGlobalSetting(key, value) {
    debugLog('保存全局设置: ' + key + '=' + value);
    return uci.load('timecontrol').then(function() {
        var sectionExists = false;
        uci.sections('timecontrol', function(s) {
            if (s['.name'] === 'timecontrol') sectionExists = true;
        });
        if (!sectionExists) {
            uci.set('timecontrol', 'timecontrol', 'list_type', 'blacklist');
            uci.set('timecontrol', 'timecontrol', 'chain', 'forward');
        }
        uci.set('timecontrol', 'timecontrol', key, value);
        return uci.save('timecontrol');
    }).then(function() {
        return uciCommitConfig();
    }).then(function() {
        debugLog('全局设置写入文件成功: ' + key + '=' + value);
        return true;
    }).catch(function(err) {
        console.error('[TimeControl] 全局设置保存失败:', err);
        throw err;
    });
}

function getDeviceUsage(id) {
    return fs.exec_direct('/usr/bin/timecontrol', ['getusage', id, 'all'])
        .then(function(res) {
            return res.trim();
        })
        .catch(function() {
            return '--';
        });
}

function resetDevice(id) {
    return fs.exec_direct('/usr/bin/timecontrol', ['reset', id]);
}

function checkTimeControlProcess() {
    return fs.exec('/bin/ps', ['w']).then(function(res) {
        if (res.code !== 0) return { running: false, pid: null };
        var lines = res.stdout.split('\n');
        var running = false, pid = null;
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].includes('timecontrolctrl')) {
                running = true;
                var match = lines[i].match(/^\s*(\d+)/);
                if (match) pid = match[1];
                break;
            }
        }
        return { running: running, pid: pid };
    }).catch(function() { return { running: false, pid: null }; });
}

// ===== 构建编辑模态框 =====
function buildModal(title, data, hosts) {
    data = data || {};
    var isEdit = !!data['.name'];
    var sectionId = data['.name'] || null;

    var defaults = {
        comment: '',
        enable: '1',
        mac: '',
        time_mode: 'period',
        timestart: '00:00',
        timeend: '00:00',
        duration: '60',
        use_duration: '0',
        reset_cycle: 'daily',
        week: '0',
        period1_start: '',
        period1_end: '',
        period1_duration: '',
        period2_start: '',
        period2_end: '',
        period2_duration: '',
        period3_start: '',
        period3_end: '',
        period3_duration: ''
    };
    var config = {};
    Object.keys(defaults).forEach(function(k) {
        config[k] = data[k] !== undefined ? data[k] : defaults[k];
    });
    if (typeof config.time_mode === 'string') config.time_mode = config.time_mode.trim();
    if (typeof config.reset_cycle === 'string') config.reset_cycle = config.reset_cycle.trim();
    if (typeof config.week === 'string') config.week = config.week.trim();
    if (typeof config.enable === 'string') config.enable = config.enable.trim();

    var overlay = E('div', { class: 'tc-modal-overlay' });
    var modal = E('div', { class: 'tc-modal' });

    var titleEl = E('h3', {}, title);
    modal.appendChild(titleEl);

    var formBox = E('div');

    var group1 = E('div', { class: 'form-group' });
    group1.appendChild(E('label', {}, _('备注')));
    group1.appendChild(E('input', { id: 'edit-comment', type: 'text', value: config.comment, placeholder: _('设备描述') }));
    formBox.appendChild(group1);

    var group2 = E('div', { class: 'form-group' });
    group2.appendChild(E('label', {}, _('启用')));
    var enableSelect = E('select', { id: 'edit-enable' });
    enableSelect.appendChild(E('option', { value: '1' }, _('是')));
    enableSelect.appendChild(E('option', { value: '0' }, _('否')));
    enableSelect.value = config.enable;
    group2.appendChild(enableSelect);
    formBox.appendChild(group2);

    var group3 = E('div', { class: 'form-group' });
    group3.appendChild(E('label', {}, _('IP/MAC 地址')));
    var selectContainer = E('div', { class: 'tc-device-select' });
    var macInput = E('input', { id: 'edit-mac', type: 'text', value: config.mac, placeholder: '例如 192.168.1.100 或 AA:BB:CC:DD:EE:FF', style: 'flex:2;' });
    var deviceSelect = E('select', { id: 'edit-device-select', style: 'flex:1;' });
    deviceSelect.appendChild(E('option', { value: '' }, _('-- 从网络设备选择 --')));
    if (hosts) {
        Object.keys(hosts).forEach(function(mac) {
            var host = hosts[mac];
            var name = host.name || _('未知设备');
            var ips = L.toArray(host.ipaddrs || host.ipv4 || []);
            var ip = ips.length > 0 ? ips[0] : '';
            var label = name + ' (' + mac + (ip ? ', ' + ip : '') + ')';
            deviceSelect.appendChild(E('option', { value: mac + (ip ? '||' + ip : '') }, label));
        });
    }
    deviceSelect.addEventListener('change', function(ev) {
        var val = ev.target.value;
        if (val) {
            var parts = val.split('||');
            macInput.value = parts[0];
        }
    });
    selectContainer.appendChild(deviceSelect);
    selectContainer.appendChild(macInput);
    group3.appendChild(selectContainer);
    formBox.appendChild(group3);

    var group4 = E('div', { class: 'form-group' });
    group4.appendChild(E('label', {}, _('控制模式')));
    var modeSelect = E('select', { id: 'edit-time_mode' });
    var modes = [
        { value: 'period', label: _('时间段控制') },
        { value: 'duration', label: _('时长控制') },
        { value: 'combined', label: _('组合控制') },
        { value: 'multi_period', label: _('多时段控制') }
    ];
    modes.forEach(function(m) {
        var opt = E('option', { value: m.value }, m.label);
        modeSelect.appendChild(opt);
    });
    modeSelect.value = config.time_mode;
    group4.appendChild(modeSelect);
    formBox.appendChild(group4);

    var dynamicContainer = E('div', { id: 'dynamic-fields' });
    formBox.appendChild(dynamicContainer);

    var groupWeek = E('div', { class: 'form-group' });
    groupWeek.appendChild(E('label', {}, _('星期')));
    var weekSelect = E('select', { id: 'edit-week' });
    var weekOptions = [
        { value: '0', label: _('每天') },
        { value: '1', label: _('周一') },
        { value: '2', label: _('周二') },
        { value: '3', label: _('周三') },
        { value: '4', label: _('周四') },
        { value: '5', label: _('周五') },
        { value: '6', label: _('周六') },
        { value: '7', label: _('周日') },
        { value: '1,2,3,4,5', label: _('工作日') },
        { value: '6,7', label: _('休息日') }
    ];
    weekOptions.forEach(function(w) {
        var opt = E('option', { value: w.value }, w.label);
        weekSelect.appendChild(opt);
    });
    weekSelect.value = config.week || '0';
    groupWeek.appendChild(weekSelect);
    formBox.appendChild(groupWeek);

    function renderDynamicFields(mode) {
        dynamicContainer.innerHTML = '';
        var curMode = mode || document.getElementById('edit-time_mode').value;

        if (curMode === 'period' || curMode === 'combined') {
            var gStart = E('div', { class: 'form-group' });
            gStart.appendChild(E('label', {}, _('允许开始时间')));
            gStart.appendChild(E('input', { id: 'edit-timestart', type: 'text', value: config.timestart || '00:00', placeholder: 'HH:MM' }));
            dynamicContainer.appendChild(gStart);

            var gEnd = E('div', { class: 'form-group' });
            gEnd.appendChild(E('label', {}, _('允许结束时间')));
            gEnd.appendChild(E('input', { id: 'edit-timeend', type: 'text', value: config.timeend || '00:00', placeholder: 'HH:MM' }));
            dynamicContainer.appendChild(gEnd);
        }

        if (curMode === 'duration' || curMode === 'combined') {
            var gDur = E('div', { class: 'form-group' });
            gDur.appendChild(E('label', {}, _('允许时长 (分钟)')));
            gDur.appendChild(E('input', { id: 'edit-duration', type: 'number', value: config.duration || '60', min: 1 }));
            dynamicContainer.appendChild(gDur);
        }

        if (curMode === 'combined') {
            var gUseDur = E('div', { class: 'form-group' });
            gUseDur.appendChild(E('label', {}, _('在时段内启用时长限制')));
            var useDurSelect = E('select', { id: 'edit-use_duration' });
            useDurSelect.appendChild(E('option', { value: '1', selected: config.use_duration === '1' }, _('是')));
            useDurSelect.appendChild(E('option', { value: '0', selected: config.use_duration === '0' }, _('否')));
            gUseDur.appendChild(useDurSelect);
            dynamicContainer.appendChild(gUseDur);
        }

        if (curMode === 'duration' || curMode === 'combined' || curMode === 'multi_period') {
            var gReset = E('div', { class: 'form-group' });
            gReset.appendChild(E('label', {}, _('重置周期')));
            var resetSelect = E('select', { id: 'edit-reset_cycle' });
            var resetOptions = [
                { value: 'daily', label: _('每日重置') },
                { value: 'weekly', label: _('每周重置') },
                { value: 'monthly', label: _('每月重置') },
                { value: 'never', label: _('永不重置 (手动)') }
            ];
            resetOptions.forEach(function(r) {
                var opt = E('option', { value: r.value }, r.label);
                resetSelect.appendChild(opt);
            });
            resetSelect.value = config.reset_cycle || 'daily';
            gReset.appendChild(resetSelect);
            dynamicContainer.appendChild(gReset);
        }

        if (curMode === 'multi_period') {
            var help = E('div', { class: 'help-text' }, _('每个时段可独立设置开始/结束时间和允许时长，时段之间互不影响。'));
            dynamicContainer.appendChild(help);

            for (var p = 1; p <= 3; p++) {
                var prefix = 'period' + p;
                var periodGroup = E('div', { class: 'period-group' });
                var pTitle = E('div', { style: 'font-weight:bold;margin-bottom:4px;' }, _('时段 %d').format(p));
                periodGroup.appendChild(pTitle);

                var row1 = E('div', { class: 'form-group' });
                row1.appendChild(E('label', { style: 'width:80px;' }, _('开始')));
                row1.appendChild(E('input', { id: 'edit-' + prefix + '_start', type: 'text', value: config[prefix + '_start'] || '', placeholder: 'HH:MM', style: 'flex:1;' }));
                periodGroup.appendChild(row1);

                var row2 = E('div', { class: 'form-group' });
                row2.appendChild(E('label', { style: 'width:80px;' }, _('结束')));
                row2.appendChild(E('input', { id: 'edit-' + prefix + '_end', type: 'text', value: config[prefix + '_end'] || '', placeholder: 'HH:MM', style: 'flex:1;' }));
                periodGroup.appendChild(row2);

                var row3 = E('div', { class: 'form-group' });
                row3.appendChild(E('label', { style: 'width:80px;' }, _('时长(分钟)')));
                row3.appendChild(E('input', { id: 'edit-' + prefix + '_duration', type: 'number', value: config[prefix + '_duration'] || '', min: 1, style: 'flex:1;' }));
                periodGroup.appendChild(row3);

                dynamicContainer.appendChild(periodGroup);
            }
        }
    }

    renderDynamicFields(config.time_mode);
    modeSelect.addEventListener('change', function(ev) {
        renderDynamicFields(ev.target.value);
    });

    modal.appendChild(formBox);

    var actions = E('div', { class: 'form-actions' });
    var cancelBtn = E('button', {
        class: 'tc-btn tc-btn-cancel',
        click: function() { document.body.removeChild(overlay); }
    }, _('取消'));
    actions.appendChild(cancelBtn);

    var saveBtn = E('button', {
        class: 'tc-btn tc-btn-save',
        click: function() {
            var newData = {};
            newData.comment = document.getElementById('edit-comment').value.trim();
            newData.enable = document.getElementById('edit-enable').value;
            newData.mac = document.getElementById('edit-mac').value.trim();
            newData.time_mode = document.getElementById('edit-time_mode').value;
            newData.week = document.getElementById('edit-week').value;

            var mode = newData.time_mode;
            if (mode === 'period' || mode === 'combined') {
                newData.timestart = document.getElementById('edit-timestart') ? document.getElementById('edit-timestart').value : '';
                newData.timeend = document.getElementById('edit-timeend') ? document.getElementById('edit-timeend').value : '';
            }
            if (mode === 'duration' || mode === 'combined') {
                newData.duration = document.getElementById('edit-duration') ? document.getElementById('edit-duration').value : '';
            }
            if (mode === 'combined') {
                newData.use_duration = document.getElementById('edit-use_duration') ? document.getElementById('edit-use_duration').value : '0';
            }
            if (mode === 'duration' || mode === 'combined' || mode === 'multi_period') {
                newData.reset_cycle = document.getElementById('edit-reset_cycle') ? document.getElementById('edit-reset_cycle').value : 'daily';
            }
            if (mode === 'multi_period') {
                for (var p = 1; p <= 3; p++) {
                    var prefix = 'period' + p;
                    var start = document.getElementById('edit-' + prefix + '_start') ? document.getElementById('edit-' + prefix + '_start').value : '';
                    var end = document.getElementById('edit-' + prefix + '_end') ? document.getElementById('edit-' + prefix + '_end').value : '';
                    var dur = document.getElementById('edit-' + prefix + '_duration') ? document.getElementById('edit-' + prefix + '_duration').value : '';
                    if (start) newData[prefix + '_start'] = start;
                    if (end) newData[prefix + '_end'] = end;
                    if (dur) newData[prefix + '_duration'] = dur;
                }
            }

            if (!newData.mac) {
                showTip(_('请输入 IP/MAC 地址'), 'error');
                return;
            }
            var existing = getDeviceList().filter(function(d) {
                if (isEdit && d['.name'] === sectionId) return false;
                return d.mac === newData.mac;
            });
            if (existing.length > 0) {
                showTip(_('该 MAC/IP 已被其他设备使用'), 'error');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = _('保存中...');

            saveDevice(sectionId, newData).then(function() {
                showTip(_('保存成功，页面即将刷新'), 'info');
                document.body.removeChild(overlay);
                setTimeout(function() { location.reload(); }, 1000);
            }).catch(function(e) {
                showTip(_('保存失败：') + e.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = _('保存');
            });
        }
    }, _('保存'));
    actions.appendChild(saveBtn);

    modal.appendChild(actions);
    overlay.appendChild(modal);

    overlay.addEventListener('click', function(ev) {
        if (ev.target === overlay) {
            document.body.removeChild(overlay);
        }
    });

    document.body.appendChild(overlay);
}

// ===== 主视图 =====
return view.extend({
    load: function() {
        debugLog('初始化配置并加载数据...');
        return ensureGlobalSection().then(function() {
            return Promise.all([
                uci.load('timecontrol'),
                network.getHostHints()
            ]);
        });
    },
    render: function(data) {
        debugLog('开始渲染自定义界面...');
        var hosts = data[1] && data[1].hosts;
        var devices = getDeviceList();

        var container = E('div', { class: 'tc-container' });

        // ★★★ 修改点3：更新版本描述 ★★★
        container.appendChild(E('div', { id: 'version-tip' }, [
            E('strong', {}, '上网时间控制 - 修复版 ' + VERSION),
            E('br'),
            E('small', {}, 'immortalwrt 25.12 适配专用版本'),
            E('br'),
            E('small', {}, '功能：在原有功能的基础上，添加多时段控制模式、流量感知计时增强计时（需安装并启用 bandix 插件，此功能才能生效），测试支持命令：ubus call luci.bandix getStatus，如果有输出MAC信息，就支持')
        ]));

        var statusDiv = E('div', { class: 'tc-status' }, _('检查服务状态...'));
        container.appendChild(statusDiv);
        function updateStatus() {
            checkTimeControlProcess().then(function(res) {
                var statusText = res.running ? _('运行中') : _('未运行');
                var color = res.running ? 'green' : 'red';
                statusDiv.innerHTML = '<span style="color:' + color + ';font-weight:bold;">' + statusText + '</span>' +
                    (res.pid ? ' (PID: ' + res.pid + ')' : '');
            }).catch(function() {
                statusDiv.innerHTML = '<span style="color:orange;">⚠ ' + _('状态检查失败') + '</span>';
            });
        }
        updateStatus();
        poll.add(updateStatus, 5);

        // ===== 全局设置 =====
        var globalSettings = E('div', { class: 'tc-global-settings' });

        // --- 控制模式 ---
        var listType = getGlobalSetting('list_type', 'blacklist');
        var listGroup = E('span', {});
        listGroup.appendChild(E('label', {}, _('控制模式')));
        var listSelect = E('select', { id: 'global-list-type' });
        listSelect.appendChild(E('option', { value: 'blacklist' }, _('黑名单')));
        listSelect.appendChild(E('option', { value: 'whitelist', disabled: true }, _('白名单')));
        listSelect.value = listType;
        listSelect.addEventListener('change', function() {
            var val = this.value;
            listSelect.disabled = true;
            setGlobalSetting('list_type', val)
                .then(function() {
                    debugLog('控制模式已保存到配置文件');
                })
                .catch(function(err) {
                    showTip(_('保存失败：') + err.message, 'error');
                })
                .finally(function() {
                    listSelect.disabled = false;
                });
        });
        listGroup.appendChild(listSelect);
        globalSettings.appendChild(listGroup);

        // --- 拦截强度 ---
        var chainType = getGlobalSetting('chain', 'forward');
        var chainGroup = E('span', {});
        chainGroup.appendChild(E('label', {}, _('拦截强度')));
        var chainSelect = E('select', { id: 'global-chain' });
        chainSelect.appendChild(E('option', { value: 'forward' }, _('普通转发控制')));
        chainSelect.appendChild(E('option', { value: 'input' }, _('强控制（阻断本机访问）')));
        chainSelect.value = chainType;
        chainSelect.addEventListener('change', function() {
            var val = this.value;
            chainSelect.disabled = true;
            setGlobalSetting('chain', val)
                .then(function() {
                    debugLog('拦截强度已保存到配置文件');
                })
                .catch(function(err) {
                    showTip(_('保存失败：') + err.message, 'error');
                })
                .finally(function() {
                    chainSelect.disabled = false;
                });
        });
        chainGroup.appendChild(chainSelect);
        globalSettings.appendChild(chainGroup);

        // ★★★ 修改点4：重启服务按钮移到拦截强度下方，另起一行 ★★★
        var restartBtn = E('button', {
            class: 'tc-btn tc-btn-save btn-restart',
            click: function() {
                var btn = this;
                btn.disabled = true;
                btn.textContent = _('重启中...');
                fs.exec_direct('/etc/init.d/timecontrol', ['restart'])
                    .then(function() {
                        showTip(_('服务已重启'), 'info');
                        btn.disabled = false;
                        btn.textContent = _('重启服务');
                        setTimeout(function() { location.reload(); }, 500);
                    })
                    .catch(function(err) {
                        console.error('[TimeControl] 重启服务失败:', err);
                        showTip(_('重启失败：') + err.message, 'error');
                        btn.disabled = false;
                        btn.textContent = _('重启服务');
                    });
            }
        }, _('重启服务'));
        // 插入到 chainGroup 后面（globalSettings 的第三个子元素位置）
        // 由于 globalSettings 是 E('div')，我们可以在其末尾追加，但为了放在拦截强度下面，我们在 chainGroup 之后插入。
        // 我们将在 chainGroup 之后直接添加 restartBtn，然后添加 trafficGroup。
        // 但为了顺序，我们先添加完 chainGroup，再 append restartBtn，再 append trafficGroup。
        // 目前 globalSettings 包含 listGroup 和 chainGroup，然后我们继续添加 restartBtn 和 trafficGroup。
        // 由于这里我们尚未 appendChild，我们可以在后面一起 append。

        // 我们先把所有元素准备好，再一次性 append。
        // 由于我们使用 container.appendChild(globalSettings) 在后面，我们先构建内容。
        // 为了方便，我们把 restartBtn 和 trafficGroup 都添加到 globalSettings 中。
        // 但为了顺序，我们先把 restartBtn 添加到 globalSettings（在 chainGroup 后），再把 trafficGroup 添加。
        // 我们将调整代码：在 chainGroup 之后直接 appendChild(restartBtn)，然后 appendChild(trafficGroup)。

        // 由于 globalSettings 已创建，我们稍后会在添加 trafficGroup 之前添加 restartBtn。
        // 但这里我们还在构建，我们先创建 trafficGroup 等。
        // 为了清晰，我们把 restartBtn 的创建放在这里，但实际插入在 chainGroup 之后。

        // 现在继续构建 trafficGroup。

        // --- 流量感知配置 ---
        // ★★★ 修改点5：阈值默认改为300 ★★★
        var trafficEnabled = getGlobalSetting('traffic_aware_enabled', '0');
        var trafficThreshold = getGlobalSetting('traffic_threshold', '300');
        var trafficConsecutive = getGlobalSetting('traffic_consecutive', '3');
        var trafficPollInterval = getGlobalSetting('traffic_poll_interval', '30');

        var trafficGroup = E('div', { class: 'traffic-settings' });
        trafficGroup.appendChild(E('label', { style: 'font-weight:bold;' }, _('流量感知计时')));
        trafficGroup.appendChild(E('br'));

        var enableCheck = E('input', {
            id: 'traffic-aware-enabled',
            type: 'checkbox',
            checked: trafficEnabled === '1'
        });
        trafficGroup.appendChild(E('label', { style: 'margin-right:10px;' }, _('启用')));
        trafficGroup.appendChild(enableCheck);

        trafficGroup.appendChild(E('label', { style: 'margin-left:15px;' }, _('阈值(KB)')));
        var thresholdInput = E('input', {
            id: 'traffic-aware-threshold',
            type: 'number',
            value: trafficThreshold,
            min: 1,
            style: 'width:70px;'
        });
        trafficGroup.appendChild(thresholdInput);

        trafficGroup.appendChild(E('label', { style: 'margin-left:15px;' }, _('连续次数')));
        var consecutiveInput = E('input', {
            id: 'traffic-aware-consecutive',
            type: 'number',
            value: trafficConsecutive,
            min: 1,
            style: 'width:70px;'
        });
        trafficGroup.appendChild(consecutiveInput);

        trafficGroup.appendChild(E('label', { style: 'margin-left:15px;' }, _('轮询间隔(秒)')));
        var intervalInput = E('input', {
            id: 'traffic-aware-interval',
            type: 'number',
            value: trafficPollInterval,
            min: 5,
            style: 'width:70px;'
        });
        trafficGroup.appendChild(intervalInput);

        trafficGroup.appendChild(E('br'));

        var hint = E('div', { class: 'hint' },
            _('需安装并启用 bandix 插件，此功能才能生效。')
        );
        trafficGroup.appendChild(hint);

        // ★★★ 修改点6：保存流量感知设置按钮仍保留在流量感知区域 ★★★
        var saveTrafficBtn = E('button', {
            class: 'tc-btn tc-btn-save btn-save-traffic',
            click: function() {
                var enabled = document.getElementById('traffic-aware-enabled').checked ? '1' : '0';
                var threshold = document.getElementById('traffic-aware-threshold').value;
                var consecutive = document.getElementById('traffic-aware-consecutive').value;
                var interval = document.getElementById('traffic-aware-interval').value;

                if (isNaN(threshold) || parseInt(threshold) < 1) {
                    showTip(_('阈值必须为大于0的整数'), 'error');
                    return;
                }
                if (isNaN(consecutive) || parseInt(consecutive) < 1) {
                    showTip(_('连续次数必须为大于0的整数'), 'error');
                    return;
                }
                if (isNaN(interval) || parseInt(interval) < 5) {
                    showTip(_('轮询间隔至少为5秒'), 'error');
                    return;
                }

                var btn = this;
                btn.disabled = true;
                btn.textContent = _('保存中...');

                var p1 = setGlobalSetting('traffic_aware_enabled', enabled);
                var p2 = setGlobalSetting('traffic_threshold', threshold);
                var p3 = setGlobalSetting('traffic_consecutive', consecutive);
                var p4 = setGlobalSetting('traffic_poll_interval', interval);

                Promise.all([p1, p2, p3, p4])
                    .then(function() {
                        return fs.exec_direct('/usr/bin/timecontrol', ['restart']);
                    })
                    .then(function() {
                        showTip(_('流量感知配置已保存并应用'), 'info');
                        setTimeout(function() { location.reload(); }, 800);
                    })
                    .catch(function(err) {
                        console.error('[TimeControl] 保存流量感知配置失败:', err);
                        showTip(_('保存失败，请检查系统日志'), 'error');
                        btn.disabled = false;
                        btn.textContent = _('保存流量感知设置');
                    });
            }
        }, _('保存流量感知设置'));
        trafficGroup.appendChild(saveTrafficBtn);

        // ★★★ 现在将 restartBtn 插入到 chainGroup 之后，然后追加 trafficGroup ★★★
        // 由于 globalSettings 已存在，我们追加元素。
        // 但此时 globalSettings 还未添加到 container，我们可以直接操作。
        // 我们先添加 restartBtn，再添加 trafficGroup。
        globalSettings.appendChild(restartBtn);
        globalSettings.appendChild(trafficGroup);

        container.appendChild(globalSettings);

        // ===== 添加设备按钮 =====
        var addBar = E('div', { class: 'tc-add-bar' });
        var addBtn = E('button', {
            class: 'tc-btn tc-btn-add',
            click: function() {
                buildModal(_('添加设备'), null, hosts);
            }
        }, _('添加设备'));
        addBar.appendChild(addBtn);
        container.appendChild(addBar);

        // ===== 设备表格 =====
        var tableWrap = E('div', { class: 'tc-table-wrap' });
        var table = E('table', { class: 'tc-table' });

        var thead = E('thead', {}, [
            E('tr', {}, [
                E('th', { 'data-field': 'comment' }, _('备注')),
                E('th', { 'data-field': 'enable' }, _('启用')),
                E('th', { 'data-field': 'mac' }, _('IP/MAC')),
                E('th', { 'data-field': 'time_mode' }, _('控制模式')),
                E('th', { 'data-field': 'timestart' }, _('开始时间')),
                E('th', { 'data-field': 'timeend' }, _('结束时间')),
                E('th', { 'data-field': 'duration' }, _('时长(分钟)')),
                E('th', { 'data-field': 'period_detail' }, _('时段详情')),
                E('th', { 'data-field': 'usage' }, _('已用时长')),
                E('th', { 'class': 'actions-cell' }, _('操作'))
            ])
        ]);
        table.appendChild(thead);

        var tbody = E('tbody');
        if (devices.length === 0) {
            tbody.appendChild(E('tr', {}, [
                E('td', { colspan: 10, class: 'tc-empty' }, _('暂无设备规则，请添加'))
            ]));
        } else {
            devices.forEach(function(dev) {
                var id = dev['.name'];
                var tr = E('tr', { 'data-id': id });

                tr.appendChild(E('td', { class: 'comment-cell' }, dev.comment || ''));
                tr.appendChild(E('td', {}, dev.enable === '1' ? _('是') : _('否')));
                tr.appendChild(E('td', { class: 'mac-cell' }, dev.mac || ''));
                var modeMap = {
                    'period': _('时间段'),
                    'duration': _('时长'),
                    'combined': _('组合'),
                    'multi_period': _('多时段')
                };
                tr.appendChild(E('td', { class: 'mode-cell' }, modeMap[dev.time_mode] || dev.time_mode));
                tr.appendChild(E('td', {}, dev.timestart || ''));
                tr.appendChild(E('td', {}, dev.timeend || ''));
                tr.appendChild(E('td', { class: 'duration-cell' }, dev.duration || ''));

                var detailText = '';
                if (dev.time_mode === 'multi_period') {
                    var details = [];
                    for (var p = 1; p <= 3; p++) {
                        var start = dev['period' + p + '_start'] || '';
                        var end = dev['period' + p + '_end'] || '';
                        var dur = dev['period' + p + '_duration'] || '';
                        if (start && end && dur) {
                            details.push(_('时段%s: %s-%s(%s分钟)').format(p, start, end, dur));
                        }
                    }
                    detailText = details.join('; ');
                } else {
                    detailText = _('单时段');
                }
                tr.appendChild(E('td', { class: 'period-detail-cell' }, detailText));

                var usageSpan = E('span', { class: 'usage-display', 'data-id': id }, _('--'));
                tr.appendChild(E('td', { class: 'usage-cell' }, usageSpan));

                var actionsTd = E('td', { class: 'actions-cell' });
                var editBtn = E('button', {
                    class: 'tc-btn tc-btn-edit',
                    click: function(ev) {
                        ev.preventDefault();
                        var devData = getDeviceById(id);
                        if (devData) {
                            buildModal(_('编辑设备'), devData, hosts);
                        } else {
                            showTip(_('设备数据不存在'), 'error');
                        }
                    }
                }, _('编辑'));
                actionsTd.appendChild(editBtn);

                var resetBtn = E('button', {
                    class: 'tc-btn tc-btn-reset',
                    click: function(ev) {
                        ev.preventDefault();
                        if (confirm(_('确定要重置该设备的时间限制吗？'))) {
                            resetDevice(id).then(function() {
                                showTip(_('重置成功，将在下一分钟生效'), 'info');
                                updateAllUsage();
                            }).catch(function(err) {
                                showTip(_('重置失败: ') + err, 'error');
                            });
                        }
                    }
                }, _('重置'));
                actionsTd.appendChild(resetBtn);

                var delBtn = E('button', {
                    class: 'tc-btn tc-btn-del',
                    click: function(ev) {
                        ev.preventDefault();
                        if (!confirm(_('确定要删除该设备规则吗？'))) return;
                        delBtn.disabled = true;
                        delBtn.textContent = _('删除中...');
                        deleteDevice(id)
                            .then(function() {
                                setTimeout(function() { location.reload(); }, 1500);
                            })
                            .catch(function() {
                                delBtn.disabled = false;
                                delBtn.textContent = _('删除');
                            });
                    }
                }, _('删除'));
                actionsTd.appendChild(delBtn);

                tr.appendChild(actionsTd);
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        container.appendChild(tableWrap);

        // ===== 轮询更新已用时长 =====
        function updateAllUsage() {
            var spans = document.querySelectorAll('.usage-display');
            if (!spans.length) return;
            var promises = [];
            spans.forEach(function(span) {
                var id = span.dataset.id;
                if (!id) return;
                var dev = null;
                for (var i = 0; i < devices.length; i++) {
                    if (devices[i]['.name'] === id) {
                        dev = devices[i];
                        break;
                    }
                }
                if (!dev) return;
                promises.push(
                    getDeviceUsage(id).then(function(output) {
                        return { span: span, dev: dev, output: output };
                    }).catch(function() {
                        return null;
                    })
                );
            });
            Promise.all(promises).then(function(results) {
                results.forEach(function(item) {
                    if (!item) return;
                    var span = item.span;
                    if (!span || !span.parentNode) return;
                    var dev = item.dev;
                    var output = item.output;
                    if (output === '--' || !output) {
                        span.textContent = '--';
                        return;
                    }
                    var mode = dev.time_mode || 'period';
                    var parts = output.split(',');
                    var displayParts = [];
                    if (mode === 'multi_period') {
                        var usageMap = {};
                        parts.forEach(function(p) {
                            var kv = p.trim().split(':');
                            if (kv.length === 2) {
                                usageMap[parseInt(kv[0])] = parseInt(kv[1]);
                            }
                        });
                        for (var p = 1; p <= 3; p++) {
                            var used = usageMap[p] !== undefined ? usageMap[p] : 0;
                            if (isNaN(used)) used = 0;
                            displayParts.push(_('时段%s: %s分钟').format(p, used));
                        }
                    } else {
                        var total = 0;
                        if (parts.length === 1 && parts[0].trim().match(/^\d+$/)) {
                            total = parseInt(parts[0].trim());
                        } else if (parts.length === 1 && parts[0].includes(':')) {
                            var kv2 = parts[0].trim().split(':');
                            total = parseInt(kv2[1]) || 0;
                        } else {
                            parts.forEach(function(p) {
                                var kv3 = p.trim().split(':');
                                if (kv3.length === 2) {
                                    total += parseInt(kv3[1]) || 0;
                                }
                            });
                        }
                        if (isNaN(total)) total = 0;
                        var limit = parseInt(dev.duration) || 0;
                        if (limit > 0 && total >= limit) {
                            displayParts.push(_('超时（%s分钟）').format(total));
                        } else {
                            displayParts.push(_('已用 %s 分钟').format(total));
                        }
                    }
                    span.textContent = displayParts.join(' | ');
                });
            }).catch(function(err) {
                console.warn('[TimeControl] 轮询更新出错:', err);
            });
        }

        setTimeout(updateAllUsage, 500);
        poll.add(function() {
            updateAllUsage();
        }, 10);

        return E('div', { class: 'cbi-map' }, [container]);
    }
});
