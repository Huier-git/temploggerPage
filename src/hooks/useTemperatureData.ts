import { useState, useEffect, useCallback, useRef } from 'react';
import { TemperatureReading, SerialConfig, ConnectionStatus, RecordingConfig, TestModeConfig, TemperatureConversionConfig } from '../types';
import { isValidTemperature, convertRawToTemperature } from '../utils/temperatureProcessor';
import { useTestMode } from './useTestMode';

// 内存优化：限制最大数据点数
const MAX_READINGS = 50000; // 最大5万个数据点
const CLEANUP_THRESHOLD = 45000; // 达到4.5万时开始清理
const CLEANUP_KEEP = 30000; // 清理后保留3万个最新数据点

export function useTemperatureData(
  serialConfig: SerialConfig,
  recordingConfig: RecordingConfig,
  connectionStatus: ConnectionStatus,
  testModeConfig: TestModeConfig,
  temperatureConversionConfig: TemperatureConversionConfig
) {
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [isReading, setIsReading] = useState(false);
  const { generateTestReading } = useTestMode(testModeConfig);
  const lastReadingTime = useRef<number>(0);

  // 内存优化：自动清理旧数据
  const optimizeMemory = useCallback((currentReadings: TemperatureReading[]) => {
    if (currentReadings.length > CLEANUP_THRESHOLD) {
      console.log(`内存优化：清理旧数据，从 ${currentReadings.length} 条减少到 ${CLEANUP_KEEP} 条`);
      // 保留最新的数据点
      return currentReadings
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-CLEANUP_KEEP);
    }
    return currentReadings;
  }, []);

  const addReading = useCallback((reading: TemperatureReading) => {
    setReadings(prev => {
      const newReadings = [...prev, reading];
      return optimizeMemory(newReadings);
    });
  }, [optimizeMemory]);

  const addMultipleReadings = useCallback((newReadings: TemperatureReading[]) => {
    setReadings(prev => {
      const combined = [...prev, ...newReadings];
      return optimizeMemory(combined);
    });
  }, [optimizeMemory]);

  const clearReadings = useCallback(() => {
    setReadings([]);
    lastReadingTime.current = 0;
    console.log('数据已清空，内存已释放');
  }, []);

  const replaceReadings = useCallback((newReadings: TemperatureReading[]) => {
    // 对导入的数据也进行内存优化
    const optimizedReadings = newReadings.length > MAX_READINGS 
      ? newReadings.slice(-MAX_READINGS)
      : newReadings;
    
    setReadings(optimizedReadings);
    console.log(`数据已替换，当前数据点: ${optimizedReadings.length}`);
  }, []);

  // Test mode data generation - 测试模式不经过温度转换
  useEffect(() => {
    if (!testModeConfig.enabled) return;

    const actualInterval = Math.max(recordingConfig.interval * 1000, 100); // 最小100ms间隔
    
    const interval = setInterval(() => {
      const now = Date.now();
      
      // 检查是否应该生成新数据（基于录制间隔）
      if (now - lastReadingTime.current >= recordingConfig.interval * 1000) {
        const testReadings = generateTestReading();
        const filteredReadings = testReadings.filter(reading => 
          recordingConfig.selectedChannels[reading.channel - 1]
        );
        
        if (filteredReadings.length > 0) {
          addMultipleReadings(filteredReadings);
          lastReadingTime.current = now;
        }
      }
    }, Math.min(actualInterval, 1000)); // 检查频率不超过1秒

    return () => clearInterval(interval);
  }, [testModeConfig, recordingConfig.selectedChannels, recordingConfig.interval, generateTestReading, addMultipleReadings]);

  // Real device data reading (only when not in test mode) - 实际设备数据经过温度转换
  const readTemperatureData = useCallback(async () => {
    if (testModeConfig.enabled || !connectionStatus.isConnected || !recordingConfig.isRecording) {
      return;
    }

    try {
      setIsReading(true);
      
      const timestamp = Date.now();
      const newReadings: TemperatureReading[] = [];
      
      // 使用自定义寄存器或连续寄存器
      const registersToRead = serialConfig.customRegisters || 
        Array.from({ length: 10 }, (_, i) => serialConfig.startRegister + i);
      
      registersToRead.forEach((register, index) => {
        const channel = index + 1;
        if (channel <= 10 && recordingConfig.selectedChannels[channel - 1]) {
          // 模拟从指定寄存器读取原始数据
          const baseRaw = 200 + (register % 100) * 2; // 基于寄存器地址的基础原始值
          const variation = Math.sin(timestamp / 30000 + channel) * 30;
          const noise = (Math.random() - 0.5) * 10;
          const rawValue = Math.round(Math.max(0, Math.min(65535, baseRaw + variation + noise)));
          
          // 使用温度转换配置进行转换（仅在实际设备模式下）
          const temperature = convertRawToTemperature(rawValue, temperatureConversionConfig);
          
          if (isValidTemperature(temperature)) {
            newReadings.push({
              timestamp,
              channel,
              temperature,
              rawValue
            });
          }
        }
      });
      
      if (newReadings.length > 0) {
        addMultipleReadings(newReadings);
      }
      
    } catch (error) {
      console.error('读取温度数据失败:', error);
    } finally {
      setIsReading(false);
    }
  }, [connectionStatus.isConnected, recordingConfig, testModeConfig.enabled, serialConfig, temperatureConversionConfig, addMultipleReadings]);

  // Set up real device data reading interval (only when not in test mode)
  useEffect(() => {
    if (testModeConfig.enabled || !connectionStatus.isConnected || !recordingConfig.isRecording) {
      return;
    }

    const interval = setInterval(() => {
      readTemperatureData();
    }, recordingConfig.interval * 1000);

    // 立即读取一次
    readTemperatureData();

    return () => clearInterval(interval);
  }, [
    connectionStatus.isConnected, 
    recordingConfig.isRecording, 
    recordingConfig.interval, 
    testModeConfig.enabled,
    readTemperatureData
  ]);

  // 内存使用监控
  useEffect(() => {
    const memoryCheck = setInterval(() => {
      if (readings.length > 0) {
        const memoryUsage = JSON.stringify(readings).length;
        const memoryMB = (memoryUsage / 1024 / 1024).toFixed(2);
        
        if (readings.length % 10000 === 0) { // 每1万条数据记录一次
          console.log(`内存使用情况: ${readings.length} 条数据, 约 ${memoryMB} MB`);
        }
      }
    }, 30000); // 每30秒检查一次

    return () => clearInterval(memoryCheck);
  }, [readings.length]);

  return {
    readings,
    isReading: isReading || testModeConfig.enabled,
    addReading,
    addMultipleReadings,
    clearReadings,
    replaceReadings
  };
}