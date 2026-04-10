/**
 * Looker Custom Visualization: Drill with Breadcrumbs Table
 *
 * Features:
 * - Renders a table inside the tile
 * - Click any dimension cell → drills deeper (in-place, no page navigation)
 * - Breadcrumb trail appears inside the tile header
 * - Back button navigates up one level
 * - All drill state lives inside the tile itself
 *
 * Setup:
 * 1. Host this file on GitHub Pages (public URL)
 * 2. Go to squareshift.cloud.looker.com/admin/visualizations
 * 3. Click "Add Visualization" and paste the public URL
 * 4. Use "Drill Breadcrumb Table" in your explore or dashboard
 */

(function() {

  // ── Styles injected once into the page ──────────────────────
  var STYLES = `
    .dbt-container {
      font-family: "Google Sans", Roboto, Arial, sans-serif;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      background: #fff;
    }

    /* ── Breadcrumb bar ── */
    .dbt-breadcrumb {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 2px;
      padding: 8px 12px 6px 12px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      min-height: 36px;
      flex-shrink: 0;
    }
    .dbt-crumb {
      font-size: 12px;
      color: #1a73e8;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      text-decoration: none;
      background: none;
      border: none;
      font-family: inherit;
    }
    .dbt-crumb:hover {
      background: #e8f0fe;
      text-decoration: underline;
    }
    .dbt-crumb.active {
      color: #202124;
      font-weight: 500;
      cursor: default;
    }
    .dbt-crumb.active:hover {
      background: none;
      text-decoration: none;
    }
    .dbt-sep {
      font-size: 12px;
      color: #9aa0a6;
      user-select: none;
      padding: 0 2px;
    }

    /* ── Table wrapper ── */
    .dbt-table-wrap {
      overflow: auto;
      flex: 1;
    }
    .dbt-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    /* ── Header ── */
    .dbt-table thead tr {
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .dbt-table th {
      padding: 9px 14px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #5f6368;
      background: #f8f9fa;
      border-bottom: 2px solid #dadce0;
      white-space: nowrap;
    }
    .dbt-table th.measure {
      text-align: right;
    }

    /* ── Body rows ── */
    .dbt-table tbody tr {
      border-bottom: 1px solid #f1f3f4;
      transition: background 0.1s;
    }
    .dbt-table tbody tr:hover {
      background: #f8f9fa;
    }
    .dbt-table td {
      padding: 8px 14px;
      color: #202124;
      white-space: nowrap;
    }
    .dbt-table td.measure {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* ── Drillable cell ── */
    .dbt-drill-link {
      color: #1a73e8;
      cursor: pointer;
      text-decoration: none;
      background: none;
      border: none;
      font: inherit;
      padding: 0;
    }
    .dbt-drill-link:hover {
      text-decoration: underline;
    }

    /* ── Empty / error states ── */
    .dbt-empty {
      padding: 32px;
      text-align: center;
      color: #9aa0a6;
      font-size: 13px;
    }

    /* ── Back button (shown when drilled in) ── */
    .dbt-back-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #1a73e8;
      cursor: pointer;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #dadce0;
      background: #fff;
      font-family: inherit;
      margin-right: 8px;
      flex-shrink: 0;
    }
    .dbt-back-btn:hover {
      background: #e8f0fe;
    }

    /* ── Drill level badge ── */
    .dbt-level-badge {
      font-size: 11px;
      color: #5f6368;
      margin-left: auto;
      padding: 2px 8px;
      background: #e8eaed;
      border-radius: 10px;
      white-space: nowrap;
      flex-shrink: 0;
    }
  `;

  // ── Inject styles once ────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("dbt-styles")) return;
    var tag = document.createElement("style");
    tag.id = "dbt-styles";
    tag.textContent = STYLES;
    document.head.appendChild(tag);
  }

  // ── Escape HTML to prevent XSS ───────────────────────────
  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Format a measure value for display ───────────────────
  function formatValue(cell) {
    if (!cell) return "—";
    if (cell.rendered != null) return cell.rendered;
    if (cell.value == null) return "—";
    var v = cell.value;
    if (typeof v === "number") {
      // Format as percentage if looks like one (0-100 range typical for pct)
      if (Number.isFinite(v)) {
        return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
      }
    }
    return String(v);
  }

  // ── Build aggregated rows from raw Looker data ────────────
  // Groups all raw rows by the value of `dimField`, sums all measures
  function aggregate(rawData, dimField, measureFields) {
    var groups = {};
    var order  = [];

    rawData.forEach(function(row) {
      var cell     = row[dimField];
      var rawVal   = cell && cell.value != null ? String(cell.value) : "(null)";
      var rendered = cell && cell.rendered != null ? cell.rendered : rawVal;

      if (!groups[rawVal]) {
        groups[rawVal] = { _raw: rawVal, _rendered: rendered };
        measureFields.forEach(function(m) { groups[rawVal][m.name] = 0; });
        order.push(rawVal);
      }

      measureFields.forEach(function(m) {
        var mCell = row[m.name];
        var v     = mCell && mCell.value != null ? Number(mCell.value) : 0;
        groups[rawVal][m.name] += isNaN(v) ? 0 : v;
      });
    });

    return order.map(function(k) { return groups[k]; });
  }

  // ── Main render function ─────────────────────────────────
  function render(el, data, queryResponse, drillState, triggerRerender) {
    var dims     = queryResponse.fields.dimension_like  || [];
    var measures = queryResponse.fields.measure_like    || [];

    if (dims.length === 0) {
      el.innerHTML = '<div class="dbt-container"><div class="dbt-empty">Add at least one dimension to use this visualization.</div></div>';
      return;
    }

    // Current drill depth — which dimension index to show
    var depth        = drillState.history.length;
    var dimIndex     = Math.min(depth, dims.length - 1);
    var currentDim   = dims[dimIndex];
    var canDrillMore = dimIndex < dims.length - 1;

    // Filter raw data to current drill selection
    var filtered = data;
    if (drillState.filter) {
      filtered = data.filter(function(row) {
        var cell = row[drillState.filter.field];
        var v    = cell && cell.value != null ? String(cell.value) : "";
        return v === drillState.filter.value;
      });
    }

    // Aggregate by current dimension
    var rows = aggregate(filtered, currentDim.name, measures);

    // ── Build HTML ──────────────────────────────────────────
    var html = '<div class="dbt-container">';

    // Breadcrumb bar
    html += '<div class="dbt-breadcrumb">';

    if (drillState.history.length > 0) {
      html += '<button class="dbt-back-btn" data-action="back">&#8592; Back</button>';
    }

    // "All" root crumb
    html += '<button class="dbt-crumb' +
      (drillState.history.length === 0 ? ' active' : '') +
      '" data-crumb="-1">All</button>';

    drillState.history.forEach(function(step, idx) {
      html += '<span class="dbt-sep">›</span>';
      var isLast = idx === drillState.history.length - 1;
      html += '<button class="dbt-crumb' + (isLast ? ' active' : '') +
        '" data-crumb="' + idx + '">' + esc(step.label) + '</button>';
    });

    // Level badge
    html += '<span class="dbt-level-badge">Level ' + (depth + 1) + ' of ' + dims.length + '</span>';
    html += '</div>'; // end breadcrumb

    // Table
    html += '<div class="dbt-table-wrap">';
    html += '<table class="dbt-table">';

    // Header
    html += '<thead><tr>';
    html += '<th>' + esc(currentDim.label_short || currentDim.label) + '</th>';
    measures.forEach(function(m) {
      html += '<th class="measure">' + esc(m.label_short || m.label) + '</th>';
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    if (rows.length === 0) {
      html += '<tr><td colspan="' + (1 + measures.length) + '" class="dbt-empty">No data for this selection.</td></tr>';
    } else {
      rows.forEach(function(row) {
        html += '<tr>';

        // Dimension cell
        if (canDrillMore) {
          html += '<td><button class="dbt-drill-link" data-drillval="' +
            esc(row._raw) + '" data-drillfield="' + esc(currentDim.name) +
            '" data-drillabel="' + esc(row._rendered) + '">' +
            esc(row._rendered) + '</button></td>';
        } else {
          html += '<td>' + esc(row._rendered) + '</td>';
        }

        // Measure cells
        measures.forEach(function(m) {
          var raw      = row[m.name];
          var cell     = filtered.find(function(r) {
            var c = r[currentDim.name];
            return c && String(c.value) === row._raw;
          });
          var rendered = cell ? formatValue(cell[m.name]) : (
            typeof raw === "number" ?
              raw.toLocaleString(undefined, { maximumFractionDigits: 1 }) :
              (raw != null ? String(raw) : "—")
          );
          html += '<td class="measure">' + esc(rendered) + '</td>';
        });

        html += '</tr>';
      });
    }

    html += '</tbody></table></div>'; // end tbody, table, table-wrap
    html += '</div>'; // end container

    el.innerHTML = html;

    // ── Attach event listeners ────────────────────────────
    // Back button
    var backBtn = el.querySelector("[data-action='back']");
    if (backBtn) {
      backBtn.addEventListener("click", function() {
        drillState.history.pop();
        drillState.filter = drillState.history.length > 0
          ? { field: drillState.history[drillState.history.length - 1].field,
              value: drillState.history[drillState.history.length - 1].value }
          : null;
        triggerRerender();
      });
    }

    // Breadcrumb crumbs
    el.querySelectorAll("[data-crumb]").forEach(function(btn) {
      var idx = parseInt(btn.getAttribute("data-crumb"), 10);
      btn.addEventListener("click", function() {
        if (idx === -1) {
          // Root — clear everything
          drillState.history = [];
          drillState.filter  = null;
        } else {
          // Navigate back to this crumb level
          drillState.history = drillState.history.slice(0, idx + 1);
          drillState.filter  = {
            field: drillState.history[drillState.history.length - 1].field,
            value: drillState.history[drillState.history.length - 1].value
          };
        }
        triggerRerender();
      });
    });

    // Drill links
    el.querySelectorAll("[data-drillval]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var val   = btn.getAttribute("data-drillval");
        var field = btn.getAttribute("data-drillfield");
        var label = btn.getAttribute("data-drillabel");
        drillState.history.push({ field: field, value: val, label: label });
        drillState.filter = { field: field, value: val };
        triggerRerender();
      });
    });
  }

  // ── Register the visualization with Looker ───────────────
  looker.plugins.visualizations.add({

    id:    "drill_breadcrumb_table",
    label: "Drill Breadcrumb Table",

    options: {
      header_bg_color: {
        type:    "string",
        label:   "Header Background Color",
        default: "#f8f9fa",
        display: "color",
        section: "Style",
        order:   1
      },
      drill_link_color: {
        type:    "string",
        label:   "Drill Link Color",
        default: "#1a73e8",
        display: "color",
        section: "Style",
        order:   2
      },
      font_size: {
        type:    "number",
        label:   "Table Font Size (px)",
        default: 13,
        section: "Style",
        order:   3
      },
      row_height: {
        type:    "number",
        label:   "Row Height (px)",
        default: 36,
        section: "Style",
        order:   4
      }
    },

    // ── create: runs once, sets up the container ──────────
    create: function(element, config) {
      injectStyles();
      element.innerHTML = '<div class="dbt-container"><div class="dbt-empty">Loading...</div></div>';

      // Drill state lives on the element so it persists
      // across updateAsync calls without resetting
      element._drillState = {
        history: [],  // [{field, value, label}]
        filter:  null // {field, value} currently active filter
      };
    },

    // ── updateAsync: runs on every data/filter change ─────
    updateAsync: function(data, element, config, queryResponse, details, done) {

      // Clear any previous errors
      this.clearErrors();

      // Validate
      if (!queryResponse.fields.dimension_like ||
           queryResponse.fields.dimension_like.length === 0) {
        this.addError({
          title:   "No dimensions",
          message: "Add at least one dimension to use this visualization."
        });
        done();
        return;
      }

      var self       = this;
      var drillState = element._drillState || { history: [], filter: null };
      element._drillState = drillState;

      // Apply config colors to injected styles dynamically
      var styleOverride = document.getElementById("dbt-style-override");
      if (!styleOverride) {
        styleOverride = document.createElement("style");
        styleOverride.id = "dbt-style-override";
        document.head.appendChild(styleOverride);
      }
      styleOverride.textContent = [
        ".dbt-table th { background: " + (config.header_bg_color || "#f8f9fa") + " !important; }",
        ".dbt-drill-link { color: " + (config.drill_link_color || "#1a73e8") + " !important; }",
        ".dbt-crumb { color: " + (config.drill_link_color || "#1a73e8") + " !important; }",
        ".dbt-table { font-size: " + (config.font_size || 13) + "px !important; }",
        ".dbt-table td, .dbt-table th { padding-top: " +
          Math.round((config.row_height || 36) * 0.22) + "px !important; padding-bottom: " +
          Math.round((config.row_height || 36) * 0.22) + "px !important; }"
      ].join("\n");

      // Re-render function — called on drill/back/crumb click
      function triggerRerender() {
        render(element, data, queryResponse, drillState, triggerRerender);
      }

      // Initial render
      render(element, data, queryResponse, drillState, triggerRerender);

      done();
    }

  });

})();
