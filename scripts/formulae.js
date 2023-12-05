function calculateAverage(payload, state) {
  payload.perfScore = sum(state.perfScore) / payload.targetSize;
  payload.clsVal = sum(state.clsVal) / payload.targetSize;
  payload.clsScore = sum(state.clsScore) / payload.targetSize;
  payload.lcpVal = sum(state.lcpVal) / payload.targetSize;
  payload.lcpScore = sum(state.lcpScore) / payload.targetSize;
  payload.tbtVal = sum(state.tbtVal) / payload.targetSize;
  payload.tbtScore = sum(state.tbtScore) / payload.targetSize;
  payload.siVal = sum(state.siVal) / payload.targetSize;
  payload.siScore = sum(state.siScore) / payload.targetSize;
}

function calculateMedian(payload, state) {
  payload.perfScore = median(state.perfScore);
  payload.clsVal = median(state.clsVal);
  payload.clsScore = median(state.clsScore);
  payload.lcpVal = median(state.lcpVal);
  payload.lcpScore = median(state.lcpScore);
  payload.tbtVal = median(state.tbtVal);
  payload.tbtScore = median(state.tbtScore);
  payload.siVal = median(state.siVal);
  payload.siScore = median(state.siScore);
}

export default function calculateResult(state, payload) {
  const { formula } = payload;
  if (formula === 'average') {
    calculateAverage(payload, state);
  }
  
  if (formula === 'median') {
    calculateMedian(payload, state);
  }
}
