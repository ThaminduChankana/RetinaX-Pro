import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// ─── helpers ───────────────────────────────────────────────────────────────

function bar(pct, color = '#0ea5e9', bg = '#e2e8f0') {
  const w = Math.min(Math.max(pct, 0), 100).toFixed(1);
  return `
    <div style="background:${bg};border-radius:4px;height:8px;overflow:hidden;margin-top:4px;">
      <div style="background:${color};width:${w}%;height:100%;border-radius:4px;"></div>
    </div>`;
}

function severityColor(label = '') {
  const l = label.toLowerCase();
  if (l.includes('no ') || l.includes('normal') || l.includes('mild')) return '#22c55e';
  if (l.includes('moderate'))  return '#f59e0b';
  if (l.includes('severe') || l.includes('proliferative')) return '#ef4444';
  return '#94a3b8';
}

function fmt(v, digits = 1) {
  return typeof v === 'number' ? v.toFixed(digits) : (v ?? '—');
}

// ─── main export ───────────────────────────────────────────────────────────

export async function saveAssessmentPDF(data) {
  const {
    name, age, gender, contact_number,
    disease, probability, disease_scores = {},
    severity, severity_confidence, impact_percentage,
    clinical_report, modality, report_id,
    image_b64, heatmap_b64,
    severity_map, discriminator_info,
  } = data;

  const isUncertain  = disease === 'Uncertain';
  const date         = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time         = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const imageTag     = image_b64   ? `<img src="data:image/jpeg;base64,${image_b64}"   style="max-width:100%;max-height:220px;object-fit:contain;border-radius:6px;display:block;margin:0 auto;" />` : '<p style="color:#64748b;font-size:11px;">Image unavailable</p>';
  const heatmapTag   = heatmap_b64 ? `<img src="data:image/jpeg;base64,${heatmap_b64}" style="max-width:100%;max-height:220px;object-fit:contain;border-radius:6px;display:block;margin:0 auto;" />` : '<p style="color:#64748b;font-size:11px;">Saliency unavailable</p>';

  // ── Probability distribution table ─────────────────────────────────────
  const sortedScores = Object.entries(disease_scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const probRows = sortedScores.map(([d, p]) => {
    const pct  = typeof p === 'number' ? p : parseFloat(p) || 0;
    const isPrimary = d === disease;
    return `
      <tr style="${isPrimary ? 'background:rgba(14,165,233,0.08);' : ''}">
        <td style="padding:6px 8px;font-weight:${isPrimary ? '700' : '400'};color:${isPrimary ? '#0284c7' : '#334155'};font-size:11px;">${d}${isPrimary ? ' ✓' : ''}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;color:${isPrimary ? '#0284c7' : '#64748b'};font-size:11px;">${fmt(pct)}%</td>
        <td style="padding:6px 8px;width:45%;">${bar(pct, isPrimary ? '#0284c7' : '#94a3b8')}</td>
      </tr>`;
  }).join('');

  // ── Severity map table (multi-disease) ──────────────────────────────────
  let severityMapSection = '';
  if (severity_map && Object.keys(severity_map).length > 0) {
    const smRows = Object.entries(severity_map).map(([d, v]) => {
      const label = v.label ?? v[0] ?? '—';
      const conf  = typeof v.confidence !== 'undefined' ? v.confidence : (v[1] ?? 0);
      const prob  = disease_scores[d] ?? 0;
      return `
        <tr>
          <td style="padding:6px 8px;color:#334155;font-size:11px;">${d}</td>
          <td style="padding:6px 8px;color:${severityColor(label)};font-weight:700;font-size:11px;">${label}</td>
          <td style="padding:6px 8px;text-align:right;color:#64748b;font-size:11px;">${fmt(prob)}%</td>
          <td style="padding:6px 8px;text-align:right;color:#64748b;font-size:11px;">${conf > 0 ? fmt(conf) + '%' : '—'}</td>
        </tr>`;
    }).join('');

    severityMapSection = `
      <div class="section">
        <div class="section-header">
          <span class="section-icon">⚠</span>
          <span>Overlapping Disease Probabilities</span>
        </div>
        <p style="color:#fbbf24;font-size:11px;margin:0 0 10px;">Multiple conditions detected. Specialist confirmation recommended.</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <th style="padding:6px 8px;text-align:left;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Disease</th>
              <th style="padding:6px 8px;text-align:left;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Severity</th>
              <th style="padding:6px 8px;text-align:right;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Det. Prob.</th>
              <th style="padding:6px 8px;text-align:right;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Sev. Conf.</th>
            </tr>
          </thead>
          <tbody>${smRows}</tbody>
        </table>
      </div>`;
  }

  // ── Discriminator section ───────────────────────────────────────────────
  let discSection = '';
  if (discriminator_info && discriminator_info.name) {
    const initRows = Object.entries(discriminator_info.initial || {}).map(([cls, p]) =>
      `<tr><td style="padding:4px 8px;color:#334155;font-size:11px;">${cls}</td><td style="padding:4px 8px;text-align:right;color:#64748b;font-size:11px;">${fmt(p)}%</td><td style="padding:4px 8px;width:40%;">${bar(p, '#94a3b8')}</td></tr>`
    ).join('');

    const discRows = Object.entries(discriminator_info.discriminator || {}).map(([cls, p]) => {
      const isFinal = cls === discriminator_info.final;
      return `<tr style="${isFinal ? 'background:rgba(14,165,233,0.08);' : ''}"><td style="padding:4px 8px;color:${isFinal ? '#0284c7' : '#334155'};font-weight:${isFinal ? '700' : '400'};font-size:11px;">${cls}${isFinal ? ' ✓' : ''}</td><td style="padding:4px 8px;text-align:right;color:${isFinal ? '#0284c7' : '#64748b'};font-size:11px;">${fmt(p)}%</td><td style="padding:4px 8px;width:40%;">${bar(p, isFinal ? '#0284c7' : '#94a3b8')}</td></tr>`;
    }).join('');

    const detectionLabel = discriminator_info.name.includes('ARMD') ? 'ARMD / CNV Detected'
      : discriminator_info.name.includes('DME') ? 'DME / DR Detected'
      : 'Ambiguous Fundus Findings';

    discSection = `
      <div class="section">
        <div class="section-header">
          <span class="section-icon">🔗</span>
          <span>Discriminator Analysis</span>
        </div>
        <div style="background:rgba(14,165,233,0.04);border:1px solid rgba(14,165,233,0.15);border-radius:6px;padding:8px 12px;margin-bottom:12px;">
          <p style="color:#0284c7;font-weight:700;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em;">${detectionLabel}</p>
          <p style="color:#64748b;font-size:10px;margin:0;">A dedicated pairwise discriminator model was applied to resolve the initial classification ambiguity.</p>
        </div>
        <div style="display:flex;gap:16px;">
          <div style="flex:1;">
            <p style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Initial Probability</p>
            <table style="width:100%;border-collapse:collapse;">${initRows}</table>
          </div>
          <div style="flex:1;border-left:1px solid #e2e8f0;padding-left:16px;">
            <p style="color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Discriminator Output</p>
            <table style="width:100%;border-collapse:collapse;">${discRows}</table>
          </div>
        </div>
        <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
          <p style="color:#64748b;font-size:10px;margin:0 0 6px;">Therefore, final verdict via <strong style="color:#0284c7;">${discriminator_info.name}</strong></p>
          <span style="background:rgba(14,165,233,0.1);border:1px solid rgba(14,165,233,0.3);color:#0284c7;border-radius:999px;padding:4px 14px;font-size:11px;font-weight:700;">✓ ${discriminator_info.final} · ${fmt(discriminator_info.final_confidence)}% confidence</span>
        </div>
      </div>`;
  }

  // ── Full HTML ───────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    background: #ffffff;
    color: #1e293b;
    font-size: 12px;
    line-height: 1.5;
    width: 210mm;
    min-height: 297mm;
    padding: 0;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 18mm 16mm;
    position: relative;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 2px solid #0ea5e9;
    margin-bottom: 18px;
  }
  .header-logo { color: #0284c7; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  .header-logo span { color: #1e293b; }
  .header-sub { color: #94a3b8; font-size: 10px; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-badge {
    background: rgba(14,165,233,0.06);
    border: 1px solid rgba(14,165,233,0.2);
    color: #0284c7;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 999px;
    padding: 3px 10px;
    display: inline-block;
    margin-bottom: 4px;
  }
  .header-date { color: #64748b; font-size: 10px; }

  /* ── Section ── */
  .section {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #0284c7;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
  }
  .section-icon { font-size: 14px; }

  /* ── Info grid ── */
  .info-grid { display: flex; flex-wrap: wrap; gap: 10px; }
  .info-cell { flex: 1; min-width: 110px; }
  .info-label { color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
  .info-value { color: #0f172a; font-size: 12px; font-weight: 600; }

  /* ── Primary diagnosis ── */
  .diag-main { font-size: 20px; font-weight: 900; color: ${isUncertain ? '#d97706' : '#0284c7'}; margin-bottom: 4px; }
  .diag-prob { color: #64748b; font-size: 12px; }
  .metric-row { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
  .metric-box {
    flex: 1; min-width: 100px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    text-align: center;
  }
  .metric-label { color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .metric-value { font-size: 18px; font-weight: 900; color: #0284c7; }
  .metric-unit  { font-size: 10px; color: #64748b; }

  /* ── Images ── */
  .img-grid { display: flex; gap: 14px; }
  .img-box  { flex: 1; text-align: center; }
  .img-caption { color: #64748b; font-size: 10px; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

  /* ── Clinical report ── */
  .report-text {
    color: #334155;
    font-size: 11px;
    line-height: 1.7;
    background: #f0f9ff;
    border-left: 3px solid #0ea5e9;
    padding: 10px 14px;
    border-radius: 0 6px 6px 0;
  }

  /* ── Disclaimer ── */
  .disclaimer {
    background: rgba(251,191,36,0.05);
    border: 1px solid rgba(251,191,36,0.2);
    border-radius: 8px;
    padding: 10px 14px;
    color: #a16207;
    font-size: 10px;
    line-height: 1.6;
  }

  /* ── Footer ── */
  .footer {
    margin-top: 18px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-left  { color: #475569; font-size: 9px; }
  .footer-right { color: #475569; font-size: 9px; text-align: right; }

  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e2e8f0; }
</style>
</head>
<body>
<div class="page">

  <!-- ══ Header ══ -->
  <div class="header">
    <div>
      <div class="header-logo">Retina<span>X</span> Pro</div>
      <div class="header-sub">Automated Clinical Ophthalmic Management System</div>
    </div>
    <div class="header-right">
      <div class="header-badge">Diagnostic Assessment Report</div>
      <div class="header-date">${date} · ${time}</div>
      <div class="header-date" style="margin-top:2px;">ID: ${(report_id || 'N/A').substring(0, 20)}</div>
    </div>
  </div>

  <!-- ══ Patient Information ══ -->
  <div class="section">
    <div class="section-header"><span class="section-icon">🪪</span><span>Patient Information</span></div>
    <div class="info-grid">
      <div class="info-cell"><div class="info-label">Patient Name</div><div class="info-value">${name || '—'}</div></div>
      <div class="info-cell"><div class="info-label">Age</div><div class="info-value">${age ? age + ' Years' : '—'}</div></div>
      <div class="info-cell"><div class="info-label">Gender</div><div class="info-value">${gender || '—'}</div></div>
      <div class="info-cell"><div class="info-label">Contact / Ref. ID</div><div class="info-value">${contact_number || '—'}</div></div>
      <div class="info-cell"><div class="info-label">Scan Modality</div><div class="info-value">${modality || '—'}</div></div>
      <div class="info-cell"><div class="info-label">Report Date</div><div class="info-value">${date}</div></div>
    </div>
  </div>

  <!-- ══ Primary Diagnosis ══ -->
  <div class="section">
    <div class="section-header"><span class="section-icon">🧬</span><span>Primary Diagnosis</span></div>
    <div class="diag-main">${isUncertain ? '⚠ Multiple Conditions Detected' : (disease || '—')}</div>
    <div class="diag-prob">Detection Confidence: <strong style="color:#0284c7;">${fmt(probability)}%</strong></div>

    <div class="metric-row">
      <div class="metric-box">
        <div class="metric-label">Severity Grade</div>
        <div class="metric-value" style="font-size:14px;color:${severityColor(severity)};">${severity || '—'}</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Severity Reliability</div>
        <div class="metric-value">${fmt(severity_confidence)}<span class="metric-unit">%</span></div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Retinal Burden</div>
        <div class="metric-value">${fmt(impact_percentage)}<span class="metric-unit">%</span></div>
      </div>
    </div>
    <div style="margin-top:12px;">
      <div style="color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Detection Confidence</div>
      ${bar(probability, '#0ea5e9', '#e2e8f0')}
      <div style="color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-top:8px;margin-bottom:4px;">Severity Reliability</div>
      ${bar(severity_confidence, '#22c55e', '#e2e8f0')}
      <div style="color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-top:8px;margin-bottom:4px;">Retinal Burden</div>
      ${bar(impact_percentage, '#f59e0b', '#e2e8f0')}
    </div>
  </div>

  ${discSection}
  ${severityMapSection}

  <!-- ══ Probability Distribution ══ -->
  <div class="section">
    <div class="section-header"><span class="section-icon">📊</span><span>Probability Distribution Across All Classes</span></div>
    <table>
      <thead>
        <tr style="border-bottom:1px solid #334155;">
          <th style="padding:6px 8px;text-align:left;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Disease Class</th>
          <th style="padding:6px 8px;text-align:right;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Probability</th>
          <th style="padding:6px 8px;color:#64748b;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Distribution</th>
        </tr>
      </thead>
      <tbody>${probRows}</tbody>
    </table>
  </div>

  <!-- ══ Retinal Scan Images ══ -->
  <div class="section">
    <div class="section-header"><span class="section-icon">🔬</span><span>Retinal Scan &amp; Saliency Analysis</span></div>
    <div class="img-grid">
      <div class="img-box">
        <div class="img-caption">Original Retinal Scan</div>
        ${imageTag}
      </div>
      <div class="img-box">
        <div class="img-caption">Hybrid Saliency Extraction (SmoothGrad)</div>
        ${heatmapTag}
      </div>
    </div>
  </div>

  <!-- ══ Clinical Report ══ -->
  <div class="section">
    <div class="section-header"><span class="section-icon">🤖</span><span>RetinaX Pro AI Clinical Assessment</span></div>
    <div class="report-text">${clinical_report || 'No clinical report generated.'}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:10px;gap:8px;">
      <span style="background:#e0f2fe;border:1px solid #bae6fd;color:#0284c7;border-radius:999px;padding:3px 10px;font-size:9px;font-weight:700;">ACOMS v5.0</span>
      <span style="background:#dcfce7;border:1px solid #bbf7d0;color:#16a34a;border-radius:999px;padding:3px 10px;font-size:9px;font-weight:700;">Validated Logic</span>
    </div>
  </div>

  <!-- ══ Disclaimer ══ -->
  <div class="disclaimer">
    ⚠ <strong>Clinical Disclaimer:</strong> This report is generated by an AI-assisted diagnostic system and is intended to support — not replace — the judgement of a qualified ophthalmologist or clinician. All findings must be confirmed by a licensed medical professional before any clinical decision is made. RetinaX Pro AI Systems accepts no liability for clinical outcomes based solely on this report.
  </div>

  <!-- ══ Footer ══ -->
  <div class="footer">
    <div class="footer-left">
      RetinaX Pro AI Systems · ACOMS v5.0<br/>
      Automated Clinical Ophthalmic Management System
    </div>
    <div class="footer-right">
      Generated: ${date} ${time}<br/>
      Report ID: ${(report_id || 'N/A').substring(0, 24)}
    </div>
  </div>

</div>
</body>
</html>`;

  // ── Print to PDF and share ──────────────────────────────────────────────
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save or Share Assessment PDF',
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
}
