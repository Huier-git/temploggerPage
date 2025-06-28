/**
 * Convert raw 16-bit register value to temperature in Celsius
 * Handles negative temperatures using two's complement
 * Resolution: 0.1°C
 */
export function convertRawToTemperature(rawValue: number, conversionConfig?: { mode: 'builtin' | 'custom'; customFormula: string }): number {
  if (!conversionConfig || conversionConfig.mode === 'builtin') {
    // 使用内置转换逻辑
    if (rawValue > 32767) {
      return (rawValue - 65536) * 0.1;
    }
    return rawValue * 0.1;
  } else {
    // 使用自定义转换公式
    try {
      const registerValue = rawValue;
      const safeEval = new Function('registerValue', `
        ${conversionConfig.customFormula}
      `);
      
      const result = safeEval(registerValue);
      
      if (typeof result !== 'number' || isNaN(result)) {
        console.error('自定义转换公式返回无效值，使用内置转换');
        return convertRawToTemperature(rawValue, { mode: 'builtin', customFormula: '' });
      }
      
      return result;
    } catch (error) {
      console.error('自定义转换公式执行失败，使用内置转换:', error);
      return convertRawToTemperature(rawValue, { mode: 'builtin', customFormula: '' });
    }
  }
}

/**
 * Validate temperature reading within reasonable bounds
 */
export function isValidTemperature(temperature: number): boolean {
  return temperature >= -273.15 && temperature <= 1000; // Reasonable bounds
}

/**
 * Generate simulated temperature data for demonstration
 */
export function generateSimulatedReading(channel: number, baseTemp: number = 25): number {
  const variation = Math.sin(Date.now() / 10000 + channel) * 5;
  const noise = (Math.random() - 0.5) * 2;
  return baseTemp + variation + noise + (channel * 2);
}

/**
 * Calculate moving average for smoothing
 */
export function calculateMovingAverage(values: number[], windowSize: number = 5): number {
  if (values.length === 0) return 0;
  
  const window = values.slice(-windowSize);
  return window.reduce((sum, val) => sum + val, 0) / window.length;
}

/**
 * Format temperature for display
 */
export function formatTemperature(temperature: number): string {
  return `${temperature.toFixed(1)}°C`;
}