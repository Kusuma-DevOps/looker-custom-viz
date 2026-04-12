looker.plugins.visualizations.add({
  options: {

    // ════════════════════════════════════════
    //  SUMMARY PANEL
    // ════════════════════════════════════════
    summary_section: {
      type: 'string',
      label: '── SUMMARY TABLE ──────────────────',
      default: '',
      order: 1
    },
    summary_title: {
      type: 'string',
      label: 'Title',
      default: 'Summary',
      order: 2
    },
    summary_group_field: {
      type: 'string',
      label: 'Group By Field ID  (left column)',
      default: '',
      placeholder: 'e.g. region_hierarchy.level_3',
      order: 3
    },
    summary_group_label: {
      type: 'string',
      label: 'Group By Column Label  (blank = use field label)',
      default: '',
      placeholder: 'e.g. Region',
      order: 4
    },
    summary_measure_field: {
      type: 'string',
      label: 'Measure Field ID  (right column)',
      default: '',
      placeholder: 'e.g. tasks.total_tasks',
      order: 5
    },
    summary_measure_label: {
      type: 'string',
      label: 'Measure Column Label  (blank = use field label)',
      default: '',
      placeholder: 'e.g. Total Tasks',
      order: 6
    },

    // ════════════════════════════════════════
    //  TABS PANEL
    // ════════════════════════════════════════
    tabs_section: {
      type: 'string',
      label: '── DETAIL TABS ─────────────────────',
      default: '',
      order: 7
    },
    back_button_label: {
      type: 'string',
      label: 'Back Button Text',
      default: '← Back to Summary',
      order: 8
    },

    // Tab 1
    tab1_label: {
      type: 'string',
      label: 'Tab 1 — Label',
      default: 'Tab 1',
      order: 9
    },
    tab1_fields: {
      type: 'string',
      label: 'Tab 1 — Field IDs (comma separated)',
      default: '',
      placeholder: 'tasks.task_name, tasks.task_status, tasks.total_tasks',
      order: 10
    },
    tab1_labels: {
      type: 'string',
      label: 'Tab 1 — Column Labels (comma separated, same order)',
      default: '',
      placeholder: 'Task Name, Status, Total Tasks',
      order: 11
    },

    // Tab 2
    tab2_label: {
      type: 'string',
      label: 'Tab 2 — Label',
      default: 'Tab 2',
      order: 12
    },
    tab2_fields: {
      type: 'string',
      label: 'Tab 2 — Field IDs (comma separated)',
      default: '',
      placeholder: 'region_hierarchy.location_name',
      order: 13
    },
    tab2_labels: {
      type: 'string',
      label: 'Tab 2 — Column Labels (comma separated, same order)',
      default: '',
      placeholder: 'Location',
      order: 14
    },

    // Tab 3
    tab3_label: {
      type: 'string',
      label: 'Tab 3 — Label',
      default: 'Tab 3',
      order: 15
    },
    tab3_fields: {
      type: 'string',
      label: 'Tab 3 — Field IDs (comma separated)',
      default: '',
      placeholder: 'tasks.task_id',
      order: 16
    },
    tab3_labels: {
      type: 'string',
      label: 'Tab 3 — Column Labels (comma separated, same order)',
      default: '',
      placeholder: 'Task ID',
      order: 17
    }
  },

  create: function(element, config) {
    element.innerHTML = '<div id="v-root" style="height:100%;width:100%;overflow:auto;font-family:Google Sans,Arial,sans-serif;font-size:13px;color:#202124;"></div>';
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

    var dimensions = queryResponse.fields.dimension_like;
    var measures   = queryResponse.fields.measure_like;
    var allFields  = dimensions.concat(measures);

    if (allFields.length === 0) {
      this.addError({ title: 'No fields', message: 'Add at least one dimension to the query.' });
      return done();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Get display value from a cell (prefers rendered)
    function cellVal(row, fieldId) {
      if (!fieldId) return '';
      var cell = row[fieldId.trim()];
      if (!cell) return '';
      if (cell.rendered != null) return String(cell.rendered);
      if (cell.value    != null) return String(cell.value);
      return '';
    }

    // Get raw number from a cell (for summing)
    function cellNum(row, fieldId) {
      if (!fieldId) return 0;
      var cell = row[fieldId.trim()];
      if (!cell || cell.value == null) return 0;
      return parseFloat(cell.value) || 0;
    }

    // Get Looker's label for a field ID
    function fieldLabel(fieldId) {
      if (!fieldId) return '';
      var f = allFields.find(function(x){ return x.name === fieldId.trim(); });
      return f ? (f.label_short || f.label || fieldId) : fieldId;
    }

    // Split a comma-separated config string into clean array
    function splitList(str) {
      if (!str) return [];
      return str.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    }

    // Resolve column header: custom label wins, then Looker label
    function header(customLabel, fieldId) {
      return (customLabel && customLabel.trim()) ? customLabel.trim() : fieldLabel(fieldId);
    }

    // ── Resolve Summary config ────────────────────────────────────────────────

    // Group field: configured → first dimension → first field
    var groupField = (config.summary_group_field || '').trim()
      || (dimensions.length ? dimensions[0].name : allFields[0].name);
    var groupLabel = header(config.summary_group_label, groupField);

    // Measure field: configured → first measure available
    var measureField = (config.summary_measure_field || '').trim()
      || (measures.length ? measures[0].name : '');

    // If no measure available at all, fall back to row count with a warning label
    var useRowCount  = !measureField;
    var measureLabel = header(config.summary_measure_label, measureField)
      || (useRowCount ? 'Count' : '');

    var summaryTitle = (config.summary_title || 'Summary').trim();

    // ════════════════════════════════════════
    //  VIEW 1 — SUMMARY TABLE
    // ════════════════════════════════════════
    if (this.vizState.view === 'summary') {

      // Aggregate rows by group field
      var map = {};
      data.forEach(function(row) {
        var key = cellVal(row, groupField) || '(blank)';
        if (!map[key]) map[key] = { count: 0, total: 0 };
        map[key].count += 1;
        if (!useRowCount) map[key].total += cellNum(row, measureField);
      });

      var entries = Object.entries(map);
      if (!entries.length) {
        container.innerHTML = '<div style="padding:20px;color:#666;">Nothing to display. Set <strong>Group By Field ID</strong> in Edit → Summary.</div>';
        return done();
      }

      // Build table rows
      var bodyRows = entries.map(function(e) {
        var name    = e[0];
        var agg     = e[1];
        var display = useRowCount
          ? agg.count.toLocaleString()
          : agg.total.toLocaleString();

        return '<tr class="sum-row" data-val="' + name + '" style="cursor:pointer;border-bottom:1px solid #f0f0f0;">'
          + '<td style="padding:11px 8px;color:#1a73e8;font-weight:500;">' + name + '</td>'
          + '<td style="padding:11px 8px;color:#333;text-align:right;">' + display + '</td>'
          + '</tr>';
      }).join('');

      container.innerHTML =
        '<div style="padding:16px;">'
        + '<h3 style="margin:0 0 14px;font-size:15px;font-weight:600;color:#202124;">'
        + summaryTitle + ' by ' + groupLabel
        + '</h3>'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<thead>'
        + '<tr style="border-bottom:2px solid #e0e0e0;color:#5f6368;font-size:11px;text-transform:uppercase;">'
        + '<th style="padding-bottom:8px;text-align:left;font-weight:600;">' + groupLabel + '</th>'
        + '<th style="padding-bottom:8px;text-align:right;font-weight:600;">' + measureLabel + '</th>'
        + '</tr>'
        + '</thead>'
        + '<tbody>' + bodyRows + '</tbody>'
        + '</table>'
        + '</div>';

      // Click handlers
      container.querySelectorAll('.sum-row').forEach(function(el) {
        el.onmouseover = function(){ el.style.background = '#f3f8ff'; };
        el.onmouseout  = function(){ el.style.background = ''; };
        el.onclick = function() {
          viz.vizState.view          = 'detail';
          viz.vizState.selectedValue = el.getAttribute('data-val');
          viz.vizState.activeTab     = 'tab1';
          viz.updateAsync(data, element, config, queryResponse, details, done);
        };
      });

      return done();
    }

    // ════════════════════════════════════════
    //  VIEW 2 — DETAIL TABS
    // ════════════════════════════════════════
    var activeTab = this.vizState.activeTab;

    var tabFields  = splitList(config[activeTab + '_fields']);
    var tabLabels  = splitList(config[activeTab + '_labels']);

    // Filter rows matching the clicked summary value
    var filtered = data.filter(function(r) {
      return (cellVal(r, groupField) || '(blank)') === viz.vizState.selectedValue;
    });

    // Tab bar
    var tabBarHtml = ['tab1', 'tab2', 'tab3'].map(function(tid) {
      var isActive = tid === activeTab;
      return '<div class="v-tab" data-tab="' + tid + '" style="'
        + 'padding:10px 18px;cursor:pointer;font-size:12px;font-weight:700;'
        + 'text-transform:uppercase;user-select:none;white-space:nowrap;'
        + 'color:' + (isActive ? '#1a73e8' : '#5f6368') + ';'
        + 'border-bottom:' + (isActive ? '3px solid #1a73e8' : '3px solid transparent') + ';">'
        + (config[tid + '_label'] || tid)
        + '</div>';
    }).join('');

    // Tab content table
    var contentHtml = '';
    if (!tabFields.length) {
      contentHtml = '<div style="padding:20px;color:#999;">No fields configured for this tab.<br>Click <strong>Edit</strong> and fill in the Field IDs under <strong>' + (config[activeTab + '_label'] || activeTab) + '</strong>.</div>';
    } else {
      var headCells = tabFields.map(function(f, i) {
        var lbl = (tabLabels[i] && tabLabels[i].trim()) ? tabLabels[i] : fieldLabel(f);
        return '<th style="padding:9px 10px;text-align:left;border-bottom:2px solid #e0e0e0;'
          + 'font-size:11px;text-transform:uppercase;color:#5f6368;font-weight:600;">'
          + lbl + '</th>';
      }).join('');

      var dataCells = '';
      if (!filtered.length) {
        dataCells = '<tr><td colspan="' + tabFields.length + '" style="padding:20px;color:#999;">'
          + 'No rows matched "' + viz.vizState.selectedValue + '".'
          + '</td></tr>';
      } else {
        dataCells = filtered.map(function(r, i) {
          var cells = tabFields.map(function(f) {
            return '<td style="padding:9px 10px;">' + cellVal(r, f) + '</td>';
          }).join('');
          return '<tr style="border-bottom:1px solid #f1f3f4;background:' + (i % 2 === 0 ? '#fff' : '#fafafa') + ';">'
            + cells + '</tr>';
        }).join('');
      }

      contentHtml = '<table style="width:100%;border-collapse:collapse;">'
        + '<thead><tr>' + headCells + '</tr></thead>'
        + '<tbody>' + dataCells + '</tbody>'
        + '</table>';
    }

    container.innerHTML =
      '<div style="padding:16px;">'

      // Header row: back button + selected value + row count
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">'
      + '<button id="v-back" style="padding:5px 14px;border:1px solid #dadce0;background:#fff;'
      + 'border-radius:4px;cursor:pointer;font-size:12px;color:#1a73e8;font-weight:700;white-space:nowrap;">'
      + (config.back_button_label || '← Back to Summary')
      + '</button>'
      + '<span style="font-size:17px;font-weight:700;color:#202124;">' + this.vizState.selectedValue + '</span>'
      + '<span style="font-size:12px;color:#888;">(' + filtered.length + ' rows)</span>'
      + '</div>'

      // Tab bar
      + '<div style="display:flex;border-bottom:1px solid #dadce0;margin-bottom:16px;overflow-x:auto;">'
      + tabBarHtml
      + '</div>'

      // Tab content
      + contentHtml
      + '</div>';

    // Back button
    var backBtn = container.querySelector('#v-back');
    if (backBtn) {
      backBtn.onclick = function() {
        viz.vizState.view = 'summary';
        viz.updateAsync(data, element, config, queryResponse, details, done);
      };
    }

    // Tab switching
    container.querySelectorAll('.v-tab').forEach(function(el) {
      el.onmouseover = function(){ if (el.dataset.tab !== viz.vizState.activeTab) el.style.color = '#202124'; };
      el.onmouseout  = function(){ if (el.dataset.tab !== viz.vizState.activeTab) el.style.color = '#5f6368'; };
      el.onclick = function() {
        viz.vizState.activeTab = el.dataset.tab;
        viz.updateAsync(data, element, config, queryResponse, details, done);
      };
    });

    done();
  }
});
