looker.plugins.visualizations.add({
  options: {
    // --- SUMMARY OPTIONS ---
    summary_title: {
      type: 'string',
      label: 'Summary: Title',
      default: 'Summary',
      order: 1
    },
    summary_dimension: {
      type: 'string',
      label: 'Summary: Group By Field (ID)',
      default: '',
      placeholder: 'e.g. region_hierarchy.level_3',
      order: 2
    },
    summary_metric: {
      type: 'string',
      label: 'Summary: Value Field (ID) — leave blank for Row Count',
      default: '',
      placeholder: 'e.g. tasks.total_tasks',
      order: 3
    },
    summary_metric_label: {
      type: 'string',
      label: 'Summary: Value Column Label',
      default: 'COUNT',
      order: 4
    },

    // --- TAB OPTIONS ---
    tab1_label: { type: 'string', label: 'Tab 1: Label', default: 'Level', order: 5 },
    tab1_fields: {
      type: 'string',
      label: 'Tab 1: Fields (IDs)',
      default: '',
      placeholder: 'tasks.task_name, tasks.task_status',
      order: 6
    },
    tab2_label: { type: 'string', label: 'Tab 2: Label', default: 'Location', order: 7 },
    tab2_fields: {
      type: 'string',
      label: 'Tab 2: Fields (IDs)',
      default: '',
      placeholder: 'region_hierarchy.location_name',
      order: 8
    },
    tab3_label: { type: 'string', label: 'Tab 3: Label', default: 'Media', order: 9 },
    tab3_fields: {
      type: 'string',
      label: 'Tab 3: Fields (IDs)',
      default: '',
      placeholder: 'tasks.task_id',
      order: 10
    },
    back_button_label: {
      type: 'string',
      label: 'Back Button Text',
      default: '← BACK TO SUMMARY',
      order: 11
    }
  },

  create: function(element, config) {
    element.innerHTML = `<div id="v-container" style="height:100%; width:100%; overflow:auto; font-family: sans-serif;"></div>`;
    this.vizState = { view: 'summary', selectedValue: null, activeTab: 'tab1' };
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const container = element.querySelector('#v-container');
    const viz = this;

    this.clearErrors();

    if (!data || data.length === 0) {
      container.innerHTML = `<div style="padding:20px; color:#666;">No data found. Please run a query.</div>`;
      return done();
    }

    const fields = queryResponse.fields.dimension_like.concat(queryResponse.fields.measure_like);
    if (fields.length === 0) {
      this.addError({ title: "No Fields", message: "Please select at least one dimension." });
      return done();
    }

    // Helper: get display value from a row cell
    const getVal = function(row, fieldName) {
      if (!fieldName) return "";
      var f = fieldName.trim();
      if (!row[f]) return "";
      var cell = row[f];
      return (cell.rendered !== undefined && cell.rendered !== null)
        ? cell.rendered
        : (cell.value !== undefined && cell.value !== null ? cell.value : "");
    };

    // Helper: get raw numeric value for summing
    const getRawVal = function(row, fieldName) {
      if (!fieldName) return 0;
      var f = fieldName.trim();
      if (!row[f]) return 0;
      var cell = row[f];
      return parseFloat(cell.value) || 0;
    };

    const getLabel = function(fieldName) {
      var match = fields.find(function(f) { return f.name === fieldName.trim(); });
      return match ? (match.label_short || match.label || fieldName) : fieldName;
    };

    // Resolve which field to group by in summary (fallback to first field)
    const summaryDimField = (config.summary_dimension || "").trim() !== ""
      ? config.summary_dimension.trim()
      : fields[0].name;

    const summaryDimLabel = getLabel(summaryDimField);

    // Resolve metric field (optional — blank = row count)
    const summaryMetricField = (config.summary_metric || "").trim();
    const summaryMetricLabel = (config.summary_metric_label || "COUNT").trim();
    const summaryTitle = (config.summary_title || "Summary").trim();

    // --- VIEW 1: SUMMARY ---
    if (this.vizState.view === 'summary') {
      const summaryMap = {};

      data.forEach(function(row) {
        var val = getVal(row, summaryDimField);
        if (val === "" || val === null || val === undefined) val = "(blank)";

        if (!summaryMap[val]) {
          summaryMap[val] = { count: 0, metric: 0 };
        }
        summaryMap[val].count += 1;

        if (summaryMetricField !== "") {
          summaryMap[val].metric += getRawVal(row, summaryMetricField);
        }
      });

      var entries = Object.entries(summaryMap);

      if (entries.length === 0) {
        container.innerHTML = `<div style="padding:20px; color:#666;">No data to display. Check your <strong>Summary: Group By Field</strong> in Edit.</div>`;
        return done();
      }

      var html = `<div style="padding:15px;">
        <h3 style="margin:0 0 15px 0; color:#333; font-size:15px;">${summaryTitle} by ${summaryDimLabel}</h3>
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead style="color:#666; font-size:12px; border-bottom:2px solid #eee;">
            <tr>
              <th style="padding-bottom:10px;">${summaryDimLabel.toUpperCase()}</th>
              <th style="padding-bottom:10px;">${summaryMetricLabel.toUpperCase()}</th>
            </tr>
          </thead>
          <tbody>`;

      entries.forEach(function(entry) {
        var name = entry[0];
        var agg = entry[1];
        var displayVal = summaryMetricField !== ""
          ? agg.metric.toLocaleString()
          : agg.count.toLocaleString();

        html += `<tr class="row-link" data-val="${name}" style="cursor:pointer; border-bottom:1px solid #f5f5f5;">
          <td style="padding:12px 5px; color:#1a73e8; font-weight:500;">${name}</td>
          <td style="color:#333;">${displayVal}</td>
        </tr>`;
      });

      html += `</tbody></table></div>`;
      container.innerHTML = html;

      container.querySelectorAll('.row-link').forEach(function(el) {
        el.addEventListener('mouseover', function() { el.style.background = '#f0f7ff'; });
        el.addEventListener('mouseout', function() { el.style.background = ''; });
        el.onclick = function() {
          viz.vizState.view = 'detail';
          viz.vizState.selectedValue = el.getAttribute('data-val');
          viz.updateAsync(data, element, config, queryResponse, details, done);
        };
      });
    }

    // --- VIEW 2: DETAIL TABS ---
    else {
      var activeTabId = this.vizState.activeTab;
      var activeTabFieldsRaw = config[activeTabId + '_fields'] || "";
      var activeTabFields = activeTabFieldsRaw.split(',').map(function(f) { return f.trim(); }).filter(function(f) { return f !== ""; });

      var filteredData = data.filter(function(r) {
        var val = getVal(r, summaryDimField);
        if (val === "" || val === null || val === undefined) val = "(blank)";
        return val === viz.vizState.selectedValue;
      });

      var html = `<div style="padding:15px;">
        <div style="display:flex; align-items:center; margin-bottom:15px;">
          <button id="v-back" style="padding:6px 12px; cursor:pointer; border:1px solid #dadce0; background:#fff; border-radius:4px; font-size:12px; color:#1a73e8; font-weight:bold;">${config.back_button_label || '← BACK TO SUMMARY'}</button>
          <span style="margin-left:15px; font-weight:bold; font-size:18px; color:#202124;">${this.vizState.selectedValue}</span>
          <span style="margin-left:10px; font-size:13px; color:#888;">(${filteredData.length} rows)</span>
        </div>
        <div style="display:flex; border-bottom:1px solid #dadce0; margin-bottom:15px;">
          ${['tab1', 'tab2', 'tab3'].map(function(tid) {
            var isActive = activeTabId === tid;
            return `<div class="v-tab" data-tab="${tid}" style="padding:10px 20px; cursor:pointer; font-size:13px; color:${isActive ? '#1a73e8' : '#5f6368'}; border-bottom:${isActive ? '3px solid #1a73e8' : '3px solid transparent'}; font-weight:bold; text-transform:uppercase; user-select:none;">${config[tid + '_label'] || tid}</div>`;
          }).join('')}
        </div>`;

      if (activeTabFields.length === 0) {
        html += `<div style="padding:20px; color:#999; font-size:13px;">No fields configured for this tab. Click <strong>Edit</strong> and add field IDs under "<strong>${config[activeTabId + '_label'] || activeTabId} Fields</strong>".</div>`;
      } else {
        html += `<table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead style="background:#f8f9fa; color:#5f6368; font-size:11px;"><tr>`;
        activeTabFields.forEach(function(f) {
          html += `<th style="padding:10px; border-bottom:2px solid #e0e0e0;">${getLabel(f).toUpperCase()}</th>`;
        });
        html += `</tr></thead><tbody>`;

        if (filteredData.length === 0) {
          html += `<tr><td colspan="${activeTabFields.length}" style="padding:20px; color:#999; font-size:13px;">No matching rows found for "${viz.vizState.selectedValue}".</td></tr>`;
        } else {
          filteredData.forEach(function(r, i) {
            html += `<tr style="border-bottom:1px solid #f1f3f4; font-size:13px; background:${i % 2 === 0 ? '#fff' : '#fafafa'};">`;
            activeTabFields.forEach(function(f) {
              html += `<td style="padding:10px;">${getVal(r, f)}</td>`;
            });
            html += `</tr>`;
          });
        }

        html += `</tbody></table>`;
      }

      html += `</div>`;
      container.innerHTML = html;

      // Use container.querySelector (not document.getElementById)
      var backBtn = container.querySelector('#v-back');
      if (backBtn) {
        backBtn.onclick = function() {
          viz.vizState.view = 'summary';
          viz.updateAsync(data, element, config, queryResponse, details, done);
        };
      }

      container.querySelectorAll('.v-tab').forEach(function(el) {
        el.addEventListener('mouseover', function() {
          if (el.getAttribute('data-tab') !== viz.vizState.activeTab) el.style.color = '#202124';
        });
        el.addEventListener('mouseout', function() {
          if (el.getAttribute('data-tab') !== viz.vizState.activeTab) el.style.color = '#5f6368';
        });
        el.onclick = function() {
          viz.vizState.activeTab = el.getAttribute('data-tab');
          viz.updateAsync(data, element, config, queryResponse, details, done);
        };
      });
    }

    done();
  }
});

