looker.plugins.visualizations.add({

  options: {
    first_step_label: {
      type: "string",
      label: "Home Step Label",
      default: "Step 1",
      section: "Breadcrumbs",
      order: 1
    },
    bar_color: {
      type: "string",
      label: "Bar Color",
      default: "#E52592",
      display: "color",
      section: "Styling",
      order: 2
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .viz-container {
          font-family: 'Open Sans', Helvetica, Arial, sans-serif;
          padding: 10px;
          height: 100%;
          overflow: auto;
          box-sizing: border-box;
        }
        .breadcrumbs {
          font-size: 13px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
        }
        .breadcrumb-link {
          color: #4285F4;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          text-decoration: none;
          background: none;
          border: none;
          font-family: inherit;
          font-size: 13px;
        }
        .breadcrumb-link:hover { background: #e8f0fe; text-decoration: underline; }
        .breadcrumb-sep { color: #999; font-size: 13px; }
        .breadcrumb-current { color: #202124; font-weight: 700; font-size: 13px; }

        .viz-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .viz-table th {
          text-align: left; font-size: 11px; color: #707781;
          border-bottom: 2px solid #EAEAEA; padding: 8px;
          text-transform: uppercase; letter-spacing: 0.4px;
        }
        .viz-table td {
          padding: 9px 8px; border-bottom: 1px solid #F5F5F5;
          font-size: 13px; color: #262D33;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .viz-table tbody tr:hover { background: #fafafa; }

        .bar-wrap { display: flex; align-items: center; gap: 8px; }
        .bar-bg {
          flex: 1; background: #f0f0f0; height: 20px;
          border-radius: 2px; overflow: hidden;
        }
        .bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease-out; }
        .bar-value { font-size: 12px; color: #333; white-space: nowrap; min-width: 50px; text-align: right; }

        .drill-menu {
          position: fixed; background: white; border: 1px solid #d1d1d1;
          box-shadow: 0 4px 14px rgba(0,0,0,0.15); display: none;
          z-index: 9999; min-width: 200px; border-radius: 6px; padding: 4px 0;
        }
        .menu-header {
          padding: 8px 14px; font-size: 11px; color: #999;
          border-bottom: 1px solid #eee; text-transform: uppercase;
          letter-spacing: 0.5px; font-weight: 600;
        }
        .menu-item {
          padding: 10px 14px; cursor: pointer; font-size: 13px;
          color: #262D33; transition: background 0.15s;
          display: flex; align-items: center; gap: 8px;
        }
        .menu-item:hover { background: #f0f4ff; color: #4285F4; }
        .menu-arrow { color: #bbb; font-size: 11px; }

        .no-data { padding: 24px; text-align: center; color: #9aa0a6; font-size: 13px; }
      </style>
      <div class="viz-container">
        <div id="nav" class="breadcrumbs"></div>
        <div id="drill-menu" class="drill-menu"></div>
        <table class="viz-table">
          <thead><tr id="headers"></tr></thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    `;

    // drillStack: array of {dimIndex, filterField, filterValue, label}
    // Each entry means "we drilled into this value at this dimension level"
    this.drillStack = [];
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.data         = data;
    this.fields       = queryResponse.fields;
    this.config       = config;
    this.queryResponse = queryResponse;
    this.render();
    done();
  },

  // ── Aggregate data by a dimension, optionally filtered ──
  aggregate: function(dimFieldName, measFieldName, filters) {
    var groups = {};
    var order  = [];

    this.data.forEach(function(row) {
      // Apply all active filters
      if (filters && filters.length > 0) {
        for (var i = 0; i < filters.length; i++) {
          var fCell = row[filters[i].field];
          var fVal  = fCell && fCell.value != null ? String(fCell.value) : "";
          if (fVal !== filters[i].value) return;
        }
      }

      var dCell = row[dimFieldName];
      var dVal  = dCell && dCell.value != null ? String(dCell.value) : "(null)";
      var mCell = row[measFieldName];
      var mVal  = mCell && mCell.value != null ? Number(mCell.value) : 0;
      if (isNaN(mVal)) mVal = 0;

      if (!groups[dVal]) {
        groups[dVal] = { label: dVal, value: 0 };
        order.push(dVal);
      }
      groups[dVal].value += mVal;
    });

    var result = order.map(function(k) { return groups[k]; });
    result.sort(function(a, b) { return b.value - a.value; });
    return result;
  },

  render: function() {
    var self  = this;
    var body  = document.getElementById('body');
    var head  = document.getElementById('headers');
    var nav   = document.getElementById('nav');
    var menu  = document.getElementById('drill-menu');

    if (!body || !head || !nav) return;
    body.innerHTML = "";

    var dims = this.fields.dimension_like;
    var meas = this.fields.measure_like[0];

    if (!dims || dims.length === 0 || !meas) {
      body.innerHTML = '<tr><td colspan="2" class="no-data">Add at least one dimension and one measure.</td></tr>';
      return;
    }

    var stack        = this.drillStack;
    var currentDepth = stack.length;           // 0 = top level
    var currentDim   = dims[currentDepth];     // dimension to show now

    // If drilled past all dimensions, show last dimension
    if (!currentDim) currentDim = dims[dims.length - 1];

    var canDrillDeeper = currentDepth < dims.length - 1;

    // ── 1. Breadcrumbs ────────────────────────────────────
    var stepLabel = this.config.first_step_label || 'Step 1';
    nav.innerHTML = "";

    // Root crumb
    var rootBtn = document.createElement('button');
    rootBtn.className   = 'breadcrumb-link';
    rootBtn.textContent = stepLabel;
    rootBtn.onclick     = function() { self.drillStack = []; self.render(); };
    nav.appendChild(rootBtn);

    // One crumb per drill step
    stack.forEach(function(step, idx) {
      var sep = document.createElement('span');
      sep.className   = 'breadcrumb-sep';
      sep.textContent = '›';
      nav.appendChild(sep);

      var crumb = document.createElement('button');
      crumb.className   = 'breadcrumb-link';
      crumb.textContent = step.label;
      crumb.onclick     = (function(capturedIdx) {
        return function() {
          self.drillStack = self.drillStack.slice(0, capturedIdx + 1);
          self.render();
        };
      })(idx);
      nav.appendChild(crumb);
    });

    // "Current Viz" indicator
    var sep = document.createElement('span');
    sep.className   = 'breadcrumb-sep';
    sep.textContent = '›';
    nav.appendChild(sep);

    var curr = document.createElement('span');
    curr.className   = 'breadcrumb-current';
    curr.textContent = 'Current Viz';
    nav.appendChild(curr);

    // ── 2. Build filters from drill stack ─────────────────
    var activeFilters = stack.map(function(s) {
      return { field: s.filterField, value: s.filterValue };
    });

    // ── 3. Aggregate ──────────────────────────────────────
    var rows   = this.aggregate(currentDim.name, meas.name, activeFilters);
    var maxVal = rows.length > 0
      ? Math.max.apply(null, rows.map(function(r) { return r.value; }))
      : 1;

    // ── 4. Headers ────────────────────────────────────────
    var dimLabel  = currentDim.label_short || currentDim.label;
    var measLabel = meas.label_short || meas.label;
    head.innerHTML =
      '<th style="width:35%">' + dimLabel + '</th>' +
      '<th style="width:65%">' + measLabel + '</th>';

    // ── 5. Rows ───────────────────────────────────────────
    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="2" class="no-data">No data for this selection.</td></tr>';
    } else {
      rows.forEach(function(row) {
        var pct        = maxVal > 0 ? (row.value / maxVal) * 100 : 0;
        var displayVal = row.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
        var barColor   = self.config.bar_color || '#E52592';

        var tr = document.createElement('tr');

        var labelTd = document.createElement('td');
        labelTd.style.width = '35%';
        labelTd.textContent = row.label;
        if (canDrillDeeper) {
          labelTd.style.cursor     = 'pointer';
          labelTd.style.fontWeight = '600';
          labelTd.style.color      = '#4285F4';
        }
        tr.appendChild(labelTd);

        var barTd = document.createElement('td');
        barTd.style.width = '65%';
        barTd.innerHTML =
          '<div class="bar-wrap">' +
            '<div class="bar-bg">' +
              '<div class="bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div>' +
            '</div>' +
            '<span class="bar-value">' + displayVal + '</span>' +
          '</div>';
        tr.appendChild(barTd);

        // Click on row label → show drill menu with remaining dimension names
        if (canDrillDeeper) {
          labelTd.onclick = function(e) {
            e.stopPropagation();
            self.showDrillMenu(e, row.label, currentDim.name, dims, currentDepth, menu);
          };
        }

        body.appendChild(tr);
      });
    }

    // Close menu on outside click
    document.onclick = function() { menu.style.display = 'none'; };
  },

  showDrillMenu: function(e, clickedLabel, currentDimField, dims, currentDepth, menu) {
    var self = this;
    e.stopPropagation();

    // Build menu items from remaining dimensions (everything after current)
    var remainingDims = [];
    for (var i = currentDepth + 1; i < dims.length; i++) {
      remainingDims.push(dims[i]);
    }

    if (remainingDims.length === 0) {
      menu.style.display = 'none';
      return;
    }

    // If only one remaining dimension, drill directly without menu
    if (remainingDims.length === 1) {
      self.drillStack.push({
        dimIndex:    currentDepth,
        filterField: currentDimField,
        filterValue: clickedLabel,
        label:       clickedLabel
      });
      self.render();
      return;
    }

    // Show menu with all remaining dimension options
    menu.style.display = 'block';
    menu.style.left    = e.clientX + 'px';
    menu.style.top     = (e.clientY + 4) + 'px';

    var headerText = 'Drill into ' + clickedLabel;
    var menuHTML   = '<div class="menu-header">' + headerText + '</div>';

    remainingDims.forEach(function(dim, idx) {
      var label = dim.label_short || dim.label;
      menuHTML += '<div class="menu-item" data-dimidx="' + (currentDepth + 1 + idx) + '">' +
        '<span class="menu-arrow">›</span> By ' + label +
      '</div>';
    });

    menu.innerHTML = menuHTML;

    // Attach click handlers to each menu item
    menu.querySelectorAll('.menu-item').forEach(function(item) {
      item.onclick = function(ev) {
        ev.stopPropagation();
        var targetDepth = parseInt(item.getAttribute('data-dimidx'), 10);
        var targetDim   = dims[targetDepth];

        // Reset stack to current depth then push new drill
        self.drillStack = self.drillStack.slice(0, currentDepth);
        self.drillStack.push({
          dimIndex:    currentDepth,
          filterField: currentDimField,
          filterValue: clickedLabel,
          label:       clickedLabel,
          nextDimIdx:  targetDepth
        });

        // If user picked a non-sequential dim, store which dim to show next
        self.nextDimOverride = targetDepth;

        menu.style.display = 'none';
        self.renderAtDepth(targetDepth, clickedLabel, currentDimField, dims);
      };
    });
  },

  renderAtDepth: function(targetDimIdx, filterValue, filterField, dims) {
    var self   = this;
    var body   = document.getElementById('body');
    var head   = document.getElementById('headers');
    var nav    = document.getElementById('nav');
    var menu   = document.getElementById('drill-menu');

    if (!body || !head || !nav) return;
    body.innerHTML = "";

    var meas      = this.fields.measure_like[0];
    var targetDim = dims[targetDimIdx];
    var stack     = this.drillStack;

    // ── Breadcrumbs ──────────────────────────────────────
    var stepLabel = this.config.first_step_label || 'Step 1';
    nav.innerHTML = "";

    var rootBtn       = document.createElement('button');
    rootBtn.className   = 'breadcrumb-link';
    rootBtn.textContent = stepLabel;
    rootBtn.onclick     = function() { self.drillStack = []; self.nextDimOverride = null; self.render(); };
    nav.appendChild(rootBtn);

    stack.forEach(function(step, idx) {
      var sep = document.createElement('span');
      sep.className   = 'breadcrumb-sep';
      sep.textContent = '›';
      nav.appendChild(sep);

      var crumb = document.createElement('button');
      crumb.className   = 'breadcrumb-link';
      crumb.textContent = step.label;
      crumb.onclick     = (function(capturedIdx) {
        return function() {
          self.drillStack        = self.drillStack.slice(0, capturedIdx + 1);
          self.nextDimOverride   = null;
          self.render();
        };
      })(idx);
      nav.appendChild(crumb);
    });

    var sep2 = document.createElement('span');
    sep2.className   = 'breadcrumb-sep';
    sep2.textContent = '›';
    nav.appendChild(sep2);

    var curr = document.createElement('span');
    curr.className   = 'breadcrumb-current';
    curr.textContent = 'Current Viz';
    nav.appendChild(curr);

    // ── Build filters ─────────────────────────────────────
    var activeFilters = [{ field: filterField, value: filterValue }];

    // ── Aggregate + render ────────────────────────────────
    var rows   = this.aggregate(targetDim.name, meas.name, activeFilters);
    var maxVal = rows.length > 0
      ? Math.max.apply(null, rows.map(function(r) { return r.value; }))
      : 1;

    var dimLabel  = targetDim.label_short || targetDim.label;
    var measLabel = meas.label_short || meas.label;
    head.innerHTML =
      '<th style="width:35%">' + dimLabel + '</th>' +
      '<th style="width:65%">' + measLabel + '</th>';

    var canDrillDeeper = targetDimIdx < dims.length - 1;

    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="2" class="no-data">No data for this selection.</td></tr>';
    } else {
      rows.forEach(function(row) {
        var pct        = maxVal > 0 ? (row.value / maxVal) * 100 : 0;
        var displayVal = row.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
        var barColor   = self.config.bar_color || '#E52592';

        var tr      = document.createElement('tr');
        var labelTd = document.createElement('td');
        labelTd.style.width    = '35%';
        labelTd.textContent    = row.label;
        if (canDrillDeeper) {
          labelTd.style.cursor     = 'pointer';
          labelTd.style.fontWeight = '600';
          labelTd.style.color      = '#4285F4';
        }
        tr.appendChild(labelTd);

        var barTd = document.createElement('td');
        barTd.style.width = '65%';
        barTd.innerHTML =
          '<div class="bar-wrap">' +
            '<div class="bar-bg">' +
              '<div class="bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div>' +
            '</div>' +
            '<span class="bar-value">' + displayVal + '</span>' +
          '</div>';
        tr.appendChild(barTd);

        if (canDrillDeeper) {
          labelTd.onclick = function(e) {
            e.stopPropagation();
            // Push this drill to stack
            self.drillStack.push({
              dimIndex:    targetDimIdx,
              filterField: targetDim.name,
              filterValue: row.label,
              label:       row.label
            });
            self.render();
          };
        }

        body.appendChild(tr);
      });
    }

    document.onclick = function() { menu.style.display = 'none'; };
  }

});
