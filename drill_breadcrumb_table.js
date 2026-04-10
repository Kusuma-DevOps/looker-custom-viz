looker.plugins.visualizations.add({

  options: {
    first_step_label: {
      type: "string",
      label: "Home Step Label",
      default: "Step 1",
      section: "Breadcrumbs",
      order: 1
    },
    drill_label_1: {
      type: "string",
      label: "First Drill Level Label",
      default: "By Sub-Category",
      section: "Drill Menu",
      order: 2
    },
    drill_label_2: {
      type: "string",
      label: "Second Drill Level Label",
      default: "By Segment",
      section: "Drill Menu",
      order: 3
    },
    bar_color: {
      type: "string",
      label: "Bar Color",
      default: "#E52592",
      display: "color",
      section: "Styling",
      order: 4
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .viz-container { font-family: 'Open Sans', Helvetica, Arial, sans-serif; padding: 10px; height: 100%; overflow: hidden; box-sizing: border-box; }
        .breadcrumbs { font-size: 14px; margin-bottom: 15px; font-weight: bold; color: #333; }
        .breadcrumb-link { color: #4285F4; cursor: pointer; text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
        .viz-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .viz-table th { text-align: left; font-size: 11px; color: #707781; border-bottom: 1px solid #EAEAEA; padding: 8px; text-transform: uppercase; }
        .viz-table td { padding: 10px 8px; border-bottom: 1px solid #F5F5F5; font-size: 13px; color: #262D33; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar-bg { background: #f0f0f0; height: 22px; width: 90%; position: relative; border-radius: 2px; display: inline-block; vertical-align: middle; }
        .bar-fill { height: 100%; transition: width 0.4s ease-out; border-radius: 2px; }
        .bar-value { display: inline-block; vertical-align: middle; font-size: 12px; color: #333; margin-left: 8px; }
        .drill-menu-popup { position: fixed; background: white; border: 1px solid #d1d1d1; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 2000; min-width: 180px; border-radius: 4px; padding: 5px 0; }
        .menu-header { padding: 8px 15px; font-size: 11px; color: #999; border-bottom: 1px solid #eee; text-transform: uppercase; letter-spacing: 0.5px; }
        .menu-item { padding: 10px 15px; cursor: pointer; font-size: 13px; color: #262D33; transition: background 0.2s; }
        .menu-item:hover { background: #F5F7F9; color: #4285F4; }
      </style>
      <div class="viz-container">
        <div id="nav" class="breadcrumbs"></div>
        <div id="mini-menu" class="drill-menu-popup"></div>
        <table class="viz-table">
          <thead><tr id="headers"></tr></thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    `;
    this.currentLevel = 0;
    this.filterVal    = null;
    this.filterVal2   = null;
    this.drillType    = null;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.data   = data;
    this.fields = queryResponse.fields;
    this.config = config;
    this.render();
    done();
  },

  aggregate: function(dimField, measField, filterDim) {
    var groups = {};
    var order  = [];
    this.data.forEach(function(row) {
      if (filterDim) {
        var fCell = row[filterDim.field];
        var fVal  = fCell && fCell.value != null ? String(fCell.value) : "";
        if (fVal !== filterDim.value) return;
      }
      var dCell = row[dimField];
      var dVal  = dCell && dCell.value != null ? String(dCell.value) : "(null)";
      var mCell = row[measField];
      var mVal  = mCell && mCell.value != null ? Number(mCell.value) : 0;
      if (isNaN(mVal)) mVal = 0;
      if (!groups[dVal]) { groups[dVal] = { label: dVal, value: 0 }; order.push(dVal); }
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
    var menu  = document.getElementById('mini-menu');
    if (!body || !head || !nav) return;
    body.innerHTML = "";

    var dims = this.fields.dimension_like;
    var meas = this.fields.measure_like[0];
    if (!dims || dims.length === 0 || !meas) {
      body.innerHTML = '<tr><td colspan="2">Add at least one dimension and one measure.</td></tr>';
      return;
    }

    var dim0 = dims[0];
    var dim1 = dims.length > 1 ? dims[1] : dims[0];
    var dim2 = dims.length > 2 ? dims[2] : dim1;

    // Breadcrumbs
    var stepLabel = this.config.first_step_label || 'Step 1';
    var navHTML   = '<span class="breadcrumb-link" id="reset">' + stepLabel + '</span>';
    if (this.currentLevel === 1) {
      navHTML += ' <span style="color:#999;margin:0 5px;">›</span><span class="breadcrumb-link" id="go-back">' + this.filterVal + '</span>';
    } else if (this.currentLevel === 2) {
      navHTML += ' <span style="color:#999;margin:0 5px;">›</span><span class="breadcrumb-link" id="go-level0">' + this.filterVal + '</span>';
      navHTML += ' <span style="color:#999;margin:0 5px;">›</span><span class="breadcrumb-link" id="go-back">' + this.filterVal2 + '</span>';
    }
    navHTML += ' <span style="color:#999;margin:0 5px;">›</span><span style="color:#000">Current Viz</span>';
    nav.innerHTML = navHTML;

    // Determine dimension + filter
    var currentDim, filterForAgg = null;
    if (this.currentLevel === 0) {
      currentDim   = dim0;
      filterForAgg = null;
    } else if (this.currentLevel === 1) {
      currentDim   = this.drillType === 2 ? dim2 : dim1;
      filterForAgg = { field: dim0.name, value: this.filterVal };
    } else {
      currentDim   = dim2;
      filterForAgg = { field: dim1.name, value: this.filterVal2 };
    }

    // Aggregate + render
    var rows   = this.aggregate(currentDim.name, meas.name, filterForAgg);
    var maxVal = rows.length > 0 ? Math.max.apply(null, rows.map(function(r) { return r.value; })) : 1;

    head.innerHTML =
      '<th style="width:35%">' + (currentDim.label_short || currentDim.label) + '</th>' +
      '<th style="width:65%">' + (meas.label_short || meas.label) + '</th>';

    rows.forEach(function(row) {
      var pct        = maxVal > 0 ? (row.value / maxVal) * 100 : 0;
      var displayVal = row.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
      var barColor   = self.config.bar_color || '#E52592';
      var canDrill   = self.currentLevel < 2 && dims.length > 1;

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="width:35%;' + (canDrill ? 'cursor:pointer;font-weight:600;' : '') + '">' + row.label + '</td>' +
        '<td style="width:65%;">' +
          '<div class="bar-bg"><div class="bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
          '<span class="bar-value">' + displayVal + '</span>' +
        '</td>';

      if (self.currentLevel === 0 && dims.length > 1) {
        tr.onclick = function(e) { self.showMenu(e, row.label, menu); };
      } else if (self.currentLevel === 1 && dims.length > 2) {
        tr.style.cursor = 'pointer';
        tr.onclick = function() { self.filterVal2 = row.label; self.currentLevel = 2; self.render(); };
      }
      body.appendChild(tr);
    });

    // Breadcrumb handlers
    var resetBtn = document.getElementById('reset');
    if (resetBtn) resetBtn.onclick = function() { self.currentLevel = 0; self.filterVal = null; self.filterVal2 = null; self.drillType = null; self.render(); };

    var backBtn = document.getElementById('go-back');
    if (backBtn) backBtn.onclick = function() {
      if (self.currentLevel === 2) { self.currentLevel = 1; self.filterVal2 = null; }
      else { self.currentLevel = 0; self.filterVal = null; self.filterVal2 = null; self.drillType = null; }
      self.render();
    };

    var level0Btn = document.getElementById('go-level0');
    if (level0Btn) level0Btn.onclick = function() { self.currentLevel = 0; self.filterVal = null; self.filterVal2 = null; self.drillType = null; self.render(); };

    window.onclick = function() { menu.style.display = 'none'; };
  },

  showMenu: function(e, label, menu) {
    var self = this;
    e.stopPropagation();
    menu.style.display = 'block';
    menu.style.left    = e.clientX + 'px';
    menu.style.top     = e.clientY + 'px';
    menu.innerHTML =
      '<div class="menu-header">Drill into ' + label + '</div>' +
      '<div class="menu-item" id="opt1">' + (this.config.drill_label_1 || 'By Sub-Category') + '</div>' +
      '<div class="menu-item" id="opt2">' + (this.config.drill_label_2 || 'By Segment') + '</div>';

    document.getElementById('opt1').onclick = function(e) { e.stopPropagation(); self.currentLevel = 1; self.filterVal = label; self.drillType = 1; menu.style.display = 'none'; self.render(); };
    document.getElementById('opt2').onclick = function(e) { e.stopPropagation(); self.currentLevel = 1; self.filterVal = label; self.drillType = 2; menu.style.display = 'none'; self.render(); };
  }
});
