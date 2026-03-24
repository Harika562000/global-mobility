import { createBlock, addSection } from './util.js';

const createZoneChart = (main, document) => {
  const zoneCharts = main.querySelectorAll('.ups-component .ups-form_wrap.ups-widget.ups-zoneChart');
  if (!zoneCharts.length) return;

  zoneCharts.forEach((zoneChart) => {
    const zoneChartTitle = zoneChart.querySelector('.ups-widget_header h2');
    const zoneChartDescriptions = zoneChart.querySelectorAll('.ups-widget_panel p');
    const zoneChartInputPlaceholder = zoneChart.querySelector('.ups-widget_panel form label');
    const zoneChartButton = zoneChart.querySelector('.ups-widget_panel form button');
    const descriptionDiv = document.createElement('div');

    zoneChart.querySelector('.ups-widget_header').remove();
    zoneChart.querySelector('.ups-widget_panel form').remove();

    zoneChartDescriptions.forEach((pTag) => {
      descriptionDiv.append(pTag);
    });

    const buttonPtag = document.createElement('p');
    buttonPtag.append(zoneChartButton);

    const zoneChartDiv = document.createElement('div');
    zoneChartDiv.append(zoneChartTitle, zoneChartInputPlaceholder, buttonPtag, descriptionDiv);

    const block = createBlock('Zone Chart', [[zoneChartDiv]]);

    zoneChart.append(block);
    addSection(block);
  });
};

export default createZoneChart;
