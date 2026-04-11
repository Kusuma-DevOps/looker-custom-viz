looker.plugins.visualizations.add({
  options: {
    tab1_label: { type: 'string', label: 'Tab 1: Label', default: 'Level', order: 1 },
    tab1_fields: { type: 'string', label: 'Tab 1: Fields (IDs)', default: '', placeholder: 'tasks.task_name, tasks.task_status', order: 2 },
    tab2_label: { type: 'string', label: 'Tab 2: Label', default: 'Location', order: 3 },
    tab2_fields: { type: 'string', label: 'Tab 2: Fields (IDs)', default: '', placeholder: 'region_hierarchy.location_name', order: 4 },
    tab3_label: { type: 'string', label: 'Tab 3: Label', default: 'Media', order: 5 },
    tab3_fields: { type: 'string', label: 'Tab 3: Fields (IDs)', default: '', placeholder: 'tasks.task_id', order: 6 },
    back_button_label: { type: 'string', label: 'Back Button Text', default: '← BACK TO SUMMARY', order: 7 }
  },

  create: function(element, config) {
    element.innerHTML = `<div id="v-container" style="height:100%; width:100%; overflow:auto; font-family: sans-serif;"></div>`;
    this.vizState = { view: 'summary', selectedValue: null, activeTab: 'tab1' };
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const container = element.querySelector('#v-container');
    const viz = this;

    // Clear previous errors
    this.clearErrors();

    // 1. Check if data exists
    if (!data || data.length === 0) {
      container.innerHTML = `<div style="padding:20px; color:#666;">No data found. Please run a query.</div>`;
      return done();
    }

    const fields = queryResponse.fields.dimension_like.concat(queryResponse.fields.measure_like);
    if (fields.length === 0) {
      this.addError({ title: "No Fields", message: "Please select at least one dimension and one measure." });
      return done();
    }

    const getVal = (row, fieldName) => {
      if (!fieldName) return "";
      var f = fieldName.trim();
      if (!row[f]) return "";
      var cell = row[f];
      // Prefer rendered value for display, fall back to value
      return (cell.rendered !== undefined && cell.rendered !== null) ? cell.rendered : (cell.value !== undefined && cell.value !== null ? cell.value : "");
    };

    const getLabel = (fieldName) => {
      var match = fields.find(function(f) { return f.name === fieldName.trim(); });
      return match ? (match.label_short || match.label || fieldName) : fieldName;
    };

    // --- VIEW 1: SUMMARY ---
    if (this.vizState.view === 'summary') {
      const mainDim = fields[0].name;
      const summaryMap = {};

      data.forEach(function(row) {
        var val = getVal(row, mainDim);
        if (val === "" || val === null || val === undefined) val = "(blank)";
        summaryMap[val] = (summaryMap[val] || 0) + 1;
      });

      var entries = Object.entries(summaryMap);

      if (entries.length === 0) {
        container.innerHTML = `<div style="padding:20px; color:#666;">No data to display. Check your field configuration in Edit.</div>`;
        return done();
      }

      var html = `<div style="padding:15px;">
        <h3 style="margin:0 0 15px 0; color:#333; font-size:15px;">Summary by ${fields[0].label_short || fields[0].label}</h3>
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead style="color:#666; font-size:12px; border-bottom:2px solid #eee;">
            <tr>
              <th style="padding-bottom:10px;">${(fields[0].label_short || fields[0].label).toUpperCase()}</th>
              <th style="padding-bottom:10px;">ROW COUNT</th>
            </tr>
          </thead>
          <tbody>`;

      entries.forEach(function(entry) {
        var name = entry[0];
        var count = entry[1];
        html += `<tr class="row-link" data-val="${name}" style="cursor:pointer; border-bottom:1px solid #f5f5f5;">
          <td style="padding:12px 5px; color:#1a73e8; font-weight:500;">${name}</td>
          <td style="color:#333;">${count}</td>
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
        var val = getVal(r, fields[0].name);
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
        html += `<div style="padding:20px; color:#999; font-size:13px;">No fields configured for this tab. Click <strong>Edit</strong> and add field IDs under "${config[activeTabId + '_label'] || activeTabId} Fields".</div>`;
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

      // FIX: use container.querySelector instead of document.getElementById
      var backBtn = container.querySelector('#v-back');
      if (backBtn) {
        backBtn.onclick = function() {
          viz.vizState.view = 'summary';
          viz.updateAsync(data, element, config, queryResponse, details, done);
        };
      }

      container.querySelectorAll('.v-tab').forEach(function(el) {
        el.addEventListener('mouseover', function() { if (el.getAttribute('data-tab') !== viz.vizState.activeTab) el.style.color = '#202124'; });
        el.addEventListener('mouseout', function() { if (el.getAttribute('data-tab') !== viz.vizState.activeTab) el.style.color = '#5f6368'; });
        el.onclick = function() {
          viz.vizState.activeTab = el.getAttribute('data-tab');
          viz.updateAsync(data, element, config, queryResponse, details, done);
        };
      });
    }

    done();
  }
});
