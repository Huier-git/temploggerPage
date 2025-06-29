import { useState, useEffect, useCallback, useRef } from 'react';
import { TemperatureReading, SerialConfig, ConnectionStatus, RecordingConfig, TestModeConfig, TemperatureConversionConfig } from '../types';
import { isValidTemperature, convertRawToTemperature } from '../utils/temperatureProcessor';
import { useTestMode } from './useTestMode';

// Memory optimization: limit maximum data points (increased by 10x)
const MAX_READINGS = 5000000; // Maximum 5M data points
const CLEANUP_THRESHOLD = 4500000; // Start cleanup at 4.5M
const CLEANUP_KEEP = 3000000; // Keep 3M newest data points after cleanup

export function useTemperatureData(
  serialConfig: SerialConfig,
  recordingConfig: RecordingConfig,
  connectionStatus: ConnectionStatus,
  testModeConfig: TestModeConfig,
  temperatureConversionConfig: TemperatureConversionConfig
) {
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [isReading, setIsReading] = useState(false);
  const { generateTestReading } = useTestMode(testModeConfig, serialConfig.registerCount); // 传入寄存器数量
  const lastReadingTime = useRef<number>(0);

  // Memory optimization: auto cleanup old data
  const optimizeMemory = useCallback((currentReadings: TemperatureReading[]) => {
    if (currentReadings.length > CLEANUP_THRESHOLD) {
      console.log(`Memory optimization: cleaning old data, reducing from ${currentReadings.length} to ${CLEANUP_KEEP} records`);
      // Keep the newest data points
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
    console.log('Data cleared, memory released');
  }, []);

  const replaceReadings = useCallback((newReadings: TemperatureReading[]) => {
    // Also apply memory optimization to imported data
    const optimizedReadings = newReadings.length > MAX_READINGS 
      ? newReadings.slice(-MAX_READINGS)
      : newReadings;
    
    setReadings(optimizedReadings);
    console.log(`Data replaced, current data points: ${optimizedReadings.length}`);
  }, []);

  // Test mode data generation - test mode does NOT go through temperature conversion
  useEffect(() => {
    if (!testModeConfig.enabled) return;

    const actualInterval = Math.max(recordingConfig.interval * 1000, 100); // minimum 100ms interval
    
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Check if new data should be generated (based on recording interval)
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
    }, Math.min(actualInterval, 1000)); // check frequency no more than 1 second

    return () => clearInterval(interval);
  }, [testModeConfig, recordingConfig.selectedChannels, recordingConfig.interval, generateTestReading, addMultipleReadings]);

  // Real device data reading (only when not in test mode) - real device data goes through temperature conversion
  const readTemperatureData = useCallback(async () => {
    if (testModeConfig.enabled || !connectionStatus.isConnected || !recordingConfig.isRecording) {
      return;
    }

    try {
      setIsReading(true);
      
      const timestamp = Date.now();
      const newReadings: TemperatureReading[] = [];
      
      // Use custom registers or consecutive registers
      const registersToRead = serialConfig.customRegisters || 
        Array.from({ length: serialConfig.registerCount }, (_, i) => serialConfig.startRegister + i);
      
      registersToRead.forEach((register, index) => {
        const channel = index + 1;
        if (channel <= serialConfig.registerCount && recordingConfig.selectedChannels[channel - 1]) {
          // Simulate reading raw data from specified register
          const baseRaw = 200 + (register % 100) * 2; // Base raw value based on register address
          const variation = Math.sin(timestamp / 30000 + channel) * 30;
          const noise = (Math.random() - 0.5) * 10;
          const rawValue = Math.round(Math.max(0, Math.min(65535, baseRaw + variation + noise)));
          
          // Use temperature conversion configuration for conversion (only in real device mode)
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
      console.error('Failed to read temperature data:', error);
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

    // Read immediately once
    readTemperatureData();

    return () => clearInterval(interval);
  }, [
    connectionStatus.isConnected, 
    recordingConfig.isRecording, 
    recordingConfig.interval, 
    testModeConfig.enabled,
    readTemperatureData
  ]);

  // Memory usage monitoring
  useEffect(() => {
    const memoryCheck = setInterval(() => {
      if (readings.length > 0) {
        const memoryUsage = JSON.stringify(readings).length;
        const memoryMB = (memoryUsage / 1024 / 1024).toFixed(2);
        
        if (readings.length % 10000 === 0) { // Log every 10k records
          console.log(`Memory usage: ${readings.length} records, approximately ${memoryMB} MB`);
        }
      }
    }, 30000); // Check every 30 seconds

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