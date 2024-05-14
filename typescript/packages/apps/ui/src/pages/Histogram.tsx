import React from 'react';
import { VictoryChart, VictoryHistogram, VictoryAxis, VictoryLabel } from 'victory';

const staticData = [
  { x: 0.1, y: 5 },
  { x: 0.2, y: 10 },
  { x: 0.3, y: 20 },
  { x: 0.4, y: 30 },
  { x: 0.5, y: 25 },
  { x: 0.6, y: 15 },
  { x: 0.7, y: 10 },
  { x: 0.8, y: 5 },
  { x: 0.9, y: 2 },
];

const Histogram: React.FC = () => {
  return (
    <VictoryChart
      domainPadding={20}
      animate={{
        duration: 500,
        onLoad: { duration: 500 },
      }}
    >
      <VictoryLabel
        text="NDVI Histogram"
        x={200}
        y={30}
        style={{ fontSize: 20, fill: 'black' }}
      />
      <VictoryAxis
        label="Wavelength"
        style={{
          axis: { stroke: 'black' },
          ticks: { stroke: 'black' },
          tickLabels: { fill: 'black' },
        }}
      />
      <VictoryAxis
        dependentAxis
        label="Frequency"
        style={{
          axis: { stroke: 'black' },
          ticks: { stroke: 'black' },
          tickLabels: { fill: 'black' },
        }}
      />
      <VictoryHistogram
        data={staticData}
        bins={9}
        binSpacing={1}
        colorScale={['#b03060', '#ff6d00', '#fcd163', '#7eb76f', '#004d13']}
        x="x"
        y="y"
      />
    </VictoryChart>
  );
};

export default Histogram;