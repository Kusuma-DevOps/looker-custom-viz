looker.plugins.visualizations.add({
  options: {

    // ── SUMMARY TABLE ─────────────────────────────────────────────────────────
    summary_title: {
      type: 'string',
      label: 'Summary: Title',
      default: 'Summary',
      order: 1
    },
    summary_group_field: {
      type: 'string',
      label: 'Summary: Group By Field ID (left column)',
      default: '',
      placeholder: 'e.g. region_hierarchy.level_3',
      order: 2
    },
    summary_group_label: {
      type: 'string',
      label: 'Summary: Group By Column Label',
      default: '',
      placeholder: 'e.g. Region',
      order: 3
    },
    summary_value_field: {
      type: 'string',
      label: 'Summary: Value Field ID (right column)',
      default: '',
      placeholder: 'e.g. tasks.total_tasks',
      order: 4
    },
    summary_value_label: {
      type: 'string',
      label: 'Summary: Value Column Label',
      default: '',
      placeholder: 'e.g. Total Tasks',
      order: 5
    },

    // ── TAB 1 ─────────────────────────────────────────────────────────────────
    tab1_label: {
      type: 'string',
      label: 'Tab 1: Label',
      default: 'Tab 1',
      order: 6
    },
    tab1_fields: {
      type: 'string',
      label: 'Tab 1: Field IDs (comma separated)',
      default: '',
      placeholder: 'tasks.task_name, tasks.task_status',
      order: 7
    },
    tab1_labels: {
      type: 'string',
      label: 'Tab 1: Column Labels (comma separated, same order as Field IDs)',
      default: '',
      placeholder: 'Task Name, Status',
      order: 8
    },

    // ── TAB 2 ─────────────────────────────────────────────────────────────────
    tab2_label: {
      type: 'string',
      label: 'Tab 2: Label',
      default: 'Tab 2',
      order: 9
    },
    tab2_fields: {
      type: 'string',
      label: 'Tab 2: Field IDs (comma separated)',
      default: '',
      placeholder: 'region_hierarchy.location_name',
      order: 10
    },
    tab2_labels: {
      type: 'string',
      label: 'Tab 2: Column Labels (comma separated, same order as Field IDs)',
      default: '',
      placeholder: 'Location',
      order: 11
    },

    // ── TAB 3 ─────────────────────────────────────────────────────────────────
    tab3_label: {
      type: 'string',
      label: 'Tab 3: Label',
      default: 'Tab 3',
      order: 12
    },
    tab3_fields: {
      type: 'string',
      label: 'Tab 3: Field IDs (comma separated)',
      default: '',
      placeholder: 'tasks.task_id',
      order: 13
    },
    tab3_labels: {
      type: 'string',
      label: 'Tab 3: Column Labels (comma separated, same order as Field IDs)',
      default: '',
      placeholder: 'Task ID',
      order: 14
    },

    // ── MISC ──────────────────────────────────────────────────────────────────
    back_button_label: {
      type: 'string',
      label: 'Back Button Text',
      default: '← Back to Summary',
      order: 15
    }
  },

  create: function(element, config) {
    element.innerHTML = '<div id="v-root" style="height:100%;width:100%;overflow:auto;font-family:Google Sans,sans-serif;font-size:13px;"></div>';
    this.vizState = { view: 'summary', selectedValue: null, activeTab: 'tab1' };
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    var container = element.querySelector('#v-root');
    var viz = this;
    this.clearErrors();

    // ── Guards ────────────────────────────────────────────────────────────────
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#666;">No data returned. Run your query first.</div>';
      return done();
    }

    var allFields = queryResponse.fields.dimension_like.concat(queryResponse.fields.measure_like);
    if (allFields.length === 0) {
      this.addError({ title: 'No fields', message: 'Add at least one dimension to the query.' });
      return done();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Display value (prefers rendered)
    function cellVal(row, fieldId) {
      if (!fieldId) return '';
      var id = fieldId.trim();
      var cell = row[id];
      if (!cell) return '';
      if (cell.rendered != null) return cell.rendered;
      if (cell.value  != null) return String(cell.value);
      return '';
    }

    // Raw number (for summing measures)
    function cellNum(row, fieldId) {
      if (!fieldId) return 0;
      var cell = row[fieldId.trim()];
      if (!cell) return 0;
      return parseFloat(cell.value) || 0;
    }

    // Looker field label fallback
    function lookerLabel(fieldId) {
      var f = allFields.find(function(x){ return x.name === fieldId.trim(); });
      return f ? (f.label_short || f.label || fieldId) : fieldId;
    }

    // Parse a comma-separated config string into a trimmed array
    function parseList(str) {
      if (!str) return [];
      return str.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    }

    // Resolve column header: use custom label if provided, else Looker label, else field id
    function colHeader(customLabel, fieldId) {
      if (customLabel && customLabel.trim()) return customLabel.trim();
      return lookerLabel(fieldId);
    }

    // ── Config resolution ─────────────────────────────────────────────────────
    var groupField = (config.summary_group_field || '').trim() || allFields[0].name;
    var groupLabel = colHeader(config.summary_group_label, groupField);

    var valueField = (config.summary_value_field || '').trim();   // blank = row count
    var valueLabel = (config.summary_value_label || '').trim() || (valueField ? lookerLabel(valueField) : 'Row Count');

    var summaryTitle = (config.summary_title || 'Summary').trim();

    // ── SUMMARY VIEW ──────────────────────────────────────────────────────────
    if (this.vizState.view === 'summary') {

      // Aggregate
      var map = {};
      data.forEach(function(row) {
        var key = cellVal(row, groupField) || '(blank)';
        if (!map[key]) map[key] = { rowCount: 0, metric: 0 };
        map[key].rowCount += 1;
        if (valueField) map[key].metric += cellNum(row, valueField);
      });

      var entries = Object.entries(map);
      if (!entries.length) {
        container.innerHTML = '<div style="padding:20px;color:#666;">Nothing to show. Check <strong>Summary: Group By Field ID</strong> in Edit.</div>';
        return done();
      }

      // Render
      var rows = entries.map(function(e) {
        var name = e[0];
        var agg  = e[1];
        var display = valueField ? Number(agg.metric).toLocaleString() : agg.rowCount.toLocaleString();
        return '<tr class="vr" data-val="' + name + '" style="cursor:pointer;border-bottom:1px solid #f0f0f0;">'
          + '<td style="padding:11px 8px;color:#1a73e8;font-weight:500;">' + name + '</td>'
          + '<td style="padding:11px 8px;color:#333;">' + display + '</td>'
          + '</tr>';
      }).join('');

      container.innerHTML =
        '<div style="padding:16px;">'
        + '<h3 style="margin:0 0 14px;font-size:15px;color:#202124;font-weight:600;">' + summaryTitle + ' by ' + groupLabel + '</h3>'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<thead><tr style="border-bottom:2px solid #e0e0e0;color:#666;font-size:11px;text-transform:uppercase;">'
        + '<th style="padding-bottom:8px;text-align:left;">' + groupLabel + '</th>'
        + '<th style="padding-bottom:8px;text-align:left;">' + valueLabel + '</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div>';

      container.querySelectorAll('.vr').forEach(function(el) {
        el.onmouseover = function(){ el.style.background = '#f3f8ff'; };
        el.onmouseout  = function(){ el.style.background = ''; };
        el.onclick = function() {
          viz.vizState.view = 'detail';
          viz.vizState.selectedValue = el.getAttribute('data-val');
          viz.updateAsync(data, element, config, queryResponse, details, done);
        };
      });

      return done();
    }

    // ── DETAIL / TAB VIEW ─────────────────────────────────────────────────────
    var activeTab = this.vizState.activeTab;

    var tabFields  = parseList(config[activeTab + '_fields']);
    var tabLabels  = parseList(config[activeTab + '_labels']);

    var filtered = data.filter(function(r) {
      return (cellVal(r, groupField) || '(blank)') === viz.vizState.selectedValue;
    });

    // Tab bar
    var tabBar = ['tab1','tab2','tab3'].map(function(tid) {
      var active = tid === activeTab;
      return '<div class="vtab" data-tab="' + tid + '" style="'
        + 'padding:10px 18px;cursor:pointer;font-size:12px;font-weight:700;text-transform:uppercase;user-select:none;'
        + 'color:' + (active ? '#1a73e8' : '#5f6368') + ';'
        + 'border-bottom:' + (active ? '3px solid #1a73e8' : '3px solid transparent') + ';">'
        + (config[tid + '_label'] || tid)
        + '</div>';
    }).join('');

    // Table
    var tableHtml = '';
    if (!tabFields.length) {
      tableHtml = '<div style="padding:20px;color:#999;">No fields set for this tab — click <strong>Edit</strong> and fill in the Field IDs.</div>';
    } else {
      var headCells = tabFields.map(function(f, i) {
        var label = tabLabels[i] ? tabLabels[i] : lookerLabel(f);
        return '<th style="padding:9px 10px;text-align:left;border-bottom:2px solid #e0e0e0;font-size:11px;text-transform:uppercase;color:#5f6368;">' + label + '</th>';
      }).join('');

      var bodyRows = filtered.length
        ? filtered.map(function(r, i) {
            var cells = tabFields.map(function(f) {
              return '<td style="padding:9px 10px;">' + cellVal(r, f) + '</td>';
            }).join('');
            return '<tr style="border-bottom:1px solid #f1f3f4;background:' + (i%2===0?'#fff':'#fafafa') + ';">' + cells + '</tr>';
          }).join('')
        : '<tr><td colspan="' + tabFields.length + '" style="padding:20px;color:#999;">No rows matched "' + viz.vizState.selectedValue + '".</td></tr>';

      tableHtml = '<table style="width:100%;border-collapse:collapse;">'
        + '<thead><tr>' + headCells + '</tr></thead>'
        + '<tbody>' + bodyRows + '</tbody>'
        + '</table>';
    }

    container.innerHTML =
      '<div style="padding:16px;">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">'
      + '<button id="vback" style="padding:5px 12px;border:1px solid #dadce0;background:#fff;border-radius:4px;cursor:pointer;font-size:12px;color:#1a73e8;font-weight:700;">'
      + (config.back_button_label || '← Back to Summary')
      + '</button>'
      + '<span style="font-size:17px;font-weight:700;color:#202124;">' + this.vizState.selectedValue + '</span>'
      + '<span style="font-size:12px;color:#888;">(' + filtered.length + ' rows)</span>'
      + '</div>'
      + '<div style="display:flex;border-bottom:1px solid #dadce0;margin-bottom:14px;">' + tabBar + '</div>'
      + tableHtml
      + '</div>';

    // Back button
    var backBtn = container.querySelector('#vback');
    if (backBtn) {
      backBtn.onclick = function() {
        viz.vizState.view = 'summary';
        viz.updateAsync(data, element, config, queryResponse, details, done);
      };
    }

    // Tab switching
    container.querySelectorAll('.vtab').forEach(function(el) {
      el.onmouseover = function(){ if(el.dataset.tab !== viz.vizState.activeTab) el.style.color='#202124'; };
      el.onmouseout  = function(){ if(el.dataset.tab !== viz.vizState.activeTab) el.style.color='#5f6368'; };
      el.onclick = function() {
        viz.vizState.activeTab = el.dataset.tab;
        viz.updateAsync(data, element, config, queryResponse, details, done);
      };
    });

    done();
  }
});
