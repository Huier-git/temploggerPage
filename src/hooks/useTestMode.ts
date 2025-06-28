import { useState, useEffect, useCallback } from 'react';
import { TemperatureReading, TestModeConfig } from '../types';

export function useTestMode(config: TestModeConfig) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTestReading = useCallback((): TemperatureReading[] => {
    const timestamp = Date.now();
    const readings: TemperatureReading[] = [];

    for (let channel = 1; channel <= 10; channel++) {
      // Base temperature: each channel has different baseline
      const baseTemp = config.temperatureRange.min + 
        ((config.temperatureRange.max - config.temperatureRange.min) / 10) * (channel - 1);
      
      // Time-related periodic variation
      const timeVariation = Math.sin(timestamp / 30000 + channel) * 
        ((config.temperatureRange.max - config.temperatureRange.min) * 0.2);
      
      // Random noise
      const noise = (Math.random() - 0.5) * 2 * config.noiseLevel * 
        (config.temperatureRange.max - config.temperatureRange.min) * 0.1;
      
      // Calculate final temperature - 测试模式直接使用温度值，不经过转换
      let temperature = baseTemp + timeVariation + noise;
      
      // Limit within specified range
      temperature = Math.max(config.temperatureRange.min, 
                           Math.min(config.temperatureRange.max, temperature));
      
      // 测试模式：直接使用温度值作为原始值，不进行转换
      const rawValue = Math.round(temperature * 10);

      readings.push({
        timestamp,
        channel,
        temperature, // 测试模式下直接使用原始温度值
        rawValue
      });
    }

    return readings;
  }, [config]);

  return {
    generateTestReading,
    isGenerating
  };
}