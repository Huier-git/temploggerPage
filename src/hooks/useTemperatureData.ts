import { useState, useEffect, useCallback, useRef } from 'react';
import { TemperatureReading, SerialConfig, ConnectionStatus, RecordingConfig, TestModeConfig, TemperatureConversionConfig, CalibrationOffset } from '../types';
import { isValidTemperature, convertRawToTemperature } from '../utils/temperatureProcessor';
import { useTestMode } from './useTestMode';

// Memory optimization: limit maximum data points (increased by 10x)
const MAX_READINGS = 5000000; // Maximum 5M data points
const CLEANUP_THRESHOLD = 4500000; // Start cleanup at 4.5M
const CLEANUP_KEEP = 3000000; // Keep 3M newest data points after cleanup

export interface RawDataReading {
  timestamp: number;
  channel: number;
  registerAddress: number;
  rawValue: number;
  convertedTemperature: number;
  conversionMethod: 'builtin' | 'custom';
}

export function useTemperatureData(
  serialConfig: SerialConfig,
  recordingConfig: RecordingConfig,
  connectionStatus: ConnectionStatus,
  testModeConfig: TestModeConfig,
  temperatureConversionConfig: TemperatureConversionConfig,
  calibrationOffsets: CalibrationOffset[] = [] // 新增：校准偏移值参数
) {
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [rawDataReadings, setRawDataReadings] = useState<RawDataReading[]>([]);
  const [isReading, setIsReading] = useState(false);
  const { generateTestReading } = useTestMode(testModeConfig, serialConfig.registerCount);
  const lastReadingTime = useRef<number>(0);
  const serialPortRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  // 新增：应用校准偏移值的函数
  const applyCalibrationToReading = useCallback((reading: TemperatureReading): TemperatureReading => {
    const offset = calibrationOffsets.find(o => o.channelId === reading.channel && o.enabled);
    
    if (offset) {
      // 验证校准偏移值的有效性
      if (typeof offset.offset !== 'number' || isNaN(offset.offset) || !isFinite(offset.offset)) {
        console.error(`Invalid calibration offset for channel ${reading.channel}:`, offset.offset);
        return reading;
      }
      
      const calibratedTemp = reading.temperature + offset.offset;
      
      // 验证校准后温度的有效性
      if (isNaN(calibratedTemp) || !isFinite(calibratedTemp)) {
        console.error(`Calibration resulted in invalid temperature for channel ${reading.channel}: ${reading.temperature} + ${offset.offset} = ${calibratedTemp}`);
        return reading;
      }
      
      return {
        ...reading,
        calibratedTemperature: calibratedTemp
      };
    }
    
    return reading;
  }, [calibrationOffsets]);

  // Memory optimization: auto cleanup old data
  const optimizeMemory = useCallback((currentReadings: TemperatureReading[]) => {
    if (currentReadings.length > CLEANUP_THRESHOLD) {
      console.log(`Memory optimization: cleaning old data, reducing from ${currentReadings.length} to ${CLEANUP_KEEP} records`);
      return currentReadings
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-CLEANUP_KEEP);
    }
    return currentReadings;
  }, []);

  // Optimize raw data memory as well
  const optimizeRawDataMemory = useCallback((currentRawData: RawDataReading[]) => {
    if (currentRawData.length > CLEANUP_THRESHOLD) {
      console.log(`Raw data memory optimization: cleaning old data, reducing from ${currentRawData.length} to ${CLEANUP_KEEP} records`);
      return currentRawData
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-CLEANUP_KEEP);
    }
    return currentRawData;
  }, []);

  // 修改：添加读数时自动应用校准
  const addReading = useCallback((reading: TemperatureReading) => {
    const calibratedReading = applyCalibrationToReading(reading);
    
    setReadings(prev => {
      const newReadings = [...prev, calibratedReading];
      return optimizeMemory(newReadings);
    });
  }, [optimizeMemory, applyCalibrationToReading]);

  const addRawDataReading = useCallback((rawReading: RawDataReading) => {
    setRawDataReadings(prev => {
      const newRawData = [...prev, rawReading];
      return optimizeRawDataMemory(newRawData);
    });
  }, [optimizeRawDataMemory]);

  // 修改：批量添加读数时自动应用校准
  const addMultipleReadings = useCallback((newReadings: TemperatureReading[]) => {
    const calibratedReadings = newReadings.map(reading => applyCalibrationToReading(reading));
    
    setReadings(prev => {
      const combined = [...prev, ...calibratedReadings];
      return optimizeMemory(combined);
    });
  }, [optimizeMemory, applyCalibrationToReading]);

  const addMultipleRawDataReadings = useCallback((newRawReadings: RawDataReading[]) => {
    setRawDataReadings(prev => {
      const combined = [...prev, ...newRawReadings];
      return optimizeRawDataMemory(combined);
    });
  }, [optimizeRawDataMemory]);

  const clearReadings = useCallback(() => {
    setReadings([]);
    setRawDataReadings([]);
    lastReadingTime.current = 0;
    console.log('Data cleared, memory released');
  }, []);

  const replaceReadings = useCallback((newReadings: TemperatureReading[]) => {
    const optimizedReadings = newReadings.length > MAX_READINGS 
      ? newReadings.slice(-MAX_READINGS)
      : newReadings;
    
    console.log('替换读数:', {
      newReadingsLength: newReadings.length,
      optimizedLength: optimizedReadings.length,
      sampleData: optimizedReadings.slice(0, 3)
    });
    
    setReadings(optimizedReadings);
    setRawDataReadings([]); // Clear raw data when replacing readings
    console.log(`Data replaced, current data points: ${optimizedReadings.length}`);
  }, []);

  // Build Modbus RTU request frame
  const buildModbusFrame = useCallback((slaveId: number, functionCode: number, startAddress: number, quantity: number): Uint8Array => {
    const frame = new Uint8Array(8);
    
    frame[0] = slaveId;
    frame[1] = functionCode;
    frame[2] = (startAddress >> 8) & 0xFF; // High byte
    frame[3] = startAddress & 0xFF;        // Low byte
    frame[4] = (quantity >> 8) & 0xFF;     // High byte
    frame[5] = quantity & 0xFF;            // Low byte
    
    // Calculate CRC
    let crc = 0xFFFF;
    for (let i = 0; i < 6; i++) {
      crc ^= frame[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc = crc >> 1;
        }
      }
    }
    
    frame[6] = crc & 0xFF;        // CRC low byte
    frame[7] = (crc >> 8) & 0xFF; // CRC high byte
    
    return frame;
  }, []);

  // Parse Modbus response
  const parseModbusResponse = useCallback((response: Uint8Array, expectedSlaveId: number, expectedFunctionCode: number): number[] | null => {
    if (response.length < 5) {
      console.error('Modbus response too short');
      return null;
    }

    const slaveId = response[0];
    const functionCode = response[1];
    const byteCount = response[2];

    if (slaveId !== expectedSlaveId) {
      console.error(`Unexpected slave ID: expected ${expectedSlaveId}, got ${slaveId}`);
      return null;
    }

    if (functionCode !== expectedFunctionCode) {
      console.error(`Unexpected function code: expected ${expectedFunctionCode}, got ${functionCode}`);
      return null;
    }

    if (response.length < 3 + byteCount + 2) {
      console.error('Modbus response incomplete');
      return null;
    }

    // Extract register values (16-bit big-endian)
    const values: number[] = [];
    for (let i = 0; i < byteCount; i += 2) {
      // 确保不会越界访问
      if (3 + i + 1 >= response.length) {
        console.error(`Modbus response data truncated at byte ${i}`);
        break;
      }
      const highByte = response[3 + i];
      const lowByte = response[3 + i + 1];
      
      // 验证字节值的有效性
      if (typeof highByte !== 'number' || typeof lowByte !== 'number' || 
          highByte < 0 || highByte > 255 || lowByte < 0 || lowByte > 255) {
        console.error(`Invalid byte values: high=${highByte}, low=${lowByte}`);
        continue;
      }
      
      const value = (highByte << 8) | lowByte;
      
      // 验证合成的16位值
      if (value < 0 || value > 65535) {
        console.error(`Invalid 16-bit value: ${value}`);
        continue;
      }
      
      values.push(value);
    }

    return values;
  }, []);

  // Get serial port references from global state (set by SerialModbusConfiguration)
  useEffect(() => {
    const checkSerialConnection = () => {
      // Try to get serial port from global window object (set by SerialModbusConfiguration)
      const globalSerialPort = (window as any).__serialPort;
      const globalReader = (window as any).__serialReader;
      const globalWriter = (window as any).__serialWriter;

      if (globalSerialPort && globalReader && globalWriter) {
        serialPortRef.current = globalSerialPort;
        readerRef.current = globalReader;
        writerRef.current = globalWriter;
      }
    };

    if (connectionStatus.isConnected) {
      checkSerialConnection();
    } else {
      serialPortRef.current = null;
      readerRef.current = null;
      writerRef.current = null;
    }
  }, [connectionStatus.isConnected]);

  // Test mode data generation - 修改：确保测试模式数据也应用校准
  useEffect(() => {
    if (!testModeConfig.enabled) return;

    const actualInterval = Math.max(recordingConfig.interval * 1000, 100);
    
    const interval = setInterval(() => {
      const now = Date.now();
      
      if (now - lastReadingTime.current >= recordingConfig.interval * 1000) {
        const testReadings = generateTestReading();
        const filteredReadings = testReadings.filter(reading => 
          recordingConfig.selectedChannels[reading.channel - 1]
        );
        
        if (filteredReadings.length > 0) {
          // 测试模式生成的数据也会自动应用校准
          addMultipleReadings(filteredReadings);
          
          // Generate corresponding raw data for test mode
          const testRawData: RawDataReading[] = filteredReadings.map(reading => ({
            timestamp: reading.timestamp,
            channel: reading.channel,
            registerAddress: serialConfig.startRegister + reading.channel - 1,
            rawValue: reading.rawValue,
            convertedTemperature: reading.temperature,
            conversionMethod: 'builtin' // Test mode uses direct temperature values
          }));
          
          addMultipleRawDataReadings(testRawData);
          lastReadingTime.current = now;
        }
      }
    }, Math.min(actualInterval, 1000));

    return () => clearInterval(interval);
  }, [testModeConfig, recordingConfig.selectedChannels, recordingConfig.interval, generateTestReading, addMultipleReadings, addMultipleRawDataReadings, serialConfig.startRegister]);

  // Real device data reading (only when not in test mode) - 修改：确保真实数据也应用校准
  const readTemperatureData = useCallback(async () => {
    if (testModeConfig.enabled || !connectionStatus.isConnected || !recordingConfig.isRecording) {
      return;
    }

    if (!readerRef.current || !writerRef.current) {
      console.error('Serial port not properly initialized');
      return;
    }

    try {
      setIsReading(true);
      
      const timestamp = Date.now();
      const newReadings: TemperatureReading[] = [];
      const newRawData: RawDataReading[] = [];
      
      // Use custom registers or consecutive registers
      const registersToRead = serialConfig.customRegisters || 
        Array.from({ length: serialConfig.registerCount }, (_, i) => serialConfig.startRegister + i);
      
      // Read all registers in one Modbus request for efficiency
      if (registersToRead.length > 0) {
        const startAddr = Math.min(...registersToRead);
        const endAddr = Math.max(...registersToRead);
        const quantity = endAddr - startAddr + 1;
        
        // 验证Modbus请求参数
        if (startAddr < 0 || startAddr > 65535 || quantity < 1 || quantity > 125) {
          console.error(`Invalid Modbus request parameters: startAddr=${startAddr}, quantity=${quantity}`);
          return;
        }
        
        // Build Modbus request (Function Code 0x03 - Read Holding Registers)
        const request = buildModbusFrame(1, 0x03, startAddr, quantity);
        
        console.log(`Sending Modbus request: Slave 1, FC 0x03, Start ${startAddr}, Quantity ${quantity}`);
        console.log('Request frame:', Array.from(request).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
        
        // Send request
        await writerRef.current.write(request);
        
        // Wait for response with timeout
        const responsePromise = readerRef.current.read();
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Response timeout')), 2000)
        );
        
        const result = await Promise.race([responsePromise, timeoutPromise]);
        
        if (result.value && result.value.length > 0) {
          console.log('Received response:', Array.from(result.value).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
          
          // Parse Modbus response
          const registerValues = parseModbusResponse(result.value, 1, 0x03);
          
          if (registerValues) {
            console.log(`Successfully parsed ${registerValues.length} register values:`, registerValues);
            
            // Process each register value
            registersToRead.forEach((registerAddr, index) => {
              const channel = index + 1;
              if (channel <= serialConfig.registerCount && recordingConfig.selectedChannels[channel - 1]) {
                const registerIndex = registerAddr - startAddr;
                if (registerIndex >= 0 && registerIndex < registerValues.length) {
                  const rawValue = registerValues[registerIndex];
                  
                  // 严格验证原始值
                  if (typeof rawValue !== 'number' || isNaN(rawValue) || rawValue < 0 || rawValue > 65535) {
                    console.error(`Invalid raw value for channel ${channel}, register ${registerAddr}: ${rawValue}`);
                    return;
                  }
                  
                  // Convert raw value to temperature using conversion configuration
                  const temperature = convertRawToTemperature(rawValue, temperatureConversionConfig);
                  
                  // 验证转换后的温度
                  if (!isValidTemperature(temperature)) {
                    console.error(`Invalid converted temperature for channel ${channel}: raw=${rawValue}, temp=${temperature}`);
                    return;
                  }
                  
                  console.log(`Channel ${channel}, Register ${registerAddr}: Raw=${rawValue}, Temp=${temperature.toFixed(1)}°C`);
                  
                  newReadings.push({
                    timestamp,
                    channel,
                    temperature,
                    rawValue
                  });
                  
                  newRawData.push({
                    timestamp,
                    channel,
                    registerAddress: registerAddr,
                    rawValue,
                    convertedTemperature: temperature,
                    conversionMethod: temperatureConversionConfig.mode
                  });
                }
              }
            });
            
            if (newReadings.length > 0) {
              // 真实设备数据也会自动应用校准
              addMultipleReadings(newReadings);
              addMultipleRawDataReadings(newRawData);
              console.log(`Added ${newReadings.length} new temperature readings`);
            }
          } else {
            console.error('Failed to parse Modbus response');
          }
        } else {
          console.error('No response received from Modbus device');
        }
      }
      
    } catch (error) {
      console.error('Failed to read temperature data:', error);
    } finally {
      setIsReading(false);
    }
  }, [
    connectionStatus.isConnected, 
    recordingConfig, 
    testModeConfig.enabled, 
    serialConfig, 
    temperatureConversionConfig, 
    addMultipleReadings,
    addMultipleRawDataReadings,
    buildModbusFrame,
    parseModbusResponse
  ]);

  // Set up real device data reading interval (only when not in test mode)
  useEffect(() => {
    if (testModeConfig.enabled || !connectionStatus.isConnected || !recordingConfig.isRecording) {
      return;
    }

    let expectedReadCount = 0;
    let actualReadCount = 0;
    const startTime = Date.now();
    
    // 使用更精确的定时器
    let timeoutId: NodeJS.Timeout;
    
    const scheduleNextRead = () => {
      expectedReadCount++;
      const expectedTime = startTime + (expectedReadCount * recordingConfig.interval * 1000);
      const currentTime = Date.now();
      const delay = Math.max(0, expectedTime - currentTime);
      
      timeoutId = setTimeout(async () => {
        try {
          await readTemperatureData();
          actualReadCount++;
        } catch (error) {
          console.error('Scheduled read failed:', error);
        }
        
        // 继续调度下一次读取
        if (connectionStatus.isConnected && recordingConfig.isRecording && !testModeConfig.enabled) {
          scheduleNextRead();
        }
      }, delay);
    };
    
    // 立即开始第一次读取
    readTemperatureData().then(() => {
      actualReadCount++;
      scheduleNextRead();
    }).catch(error => {
      console.error('Initial read failed:', error);
      scheduleNextRead();
    });
    
    // 定期输出统计信息
    const statsInterval = setInterval(() => {
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const expectedTotal = Math.floor(elapsedSeconds / recordingConfig.interval);
      const efficiency = expectedTotal > 0 ? (actualReadCount / expectedTotal * 100).toFixed(1) : '0.0';
      console.log(`Data collection stats: Expected=${expectedTotal}, Actual=${actualReadCount}, Efficiency=${efficiency}%`);
    }, 30000); // 每30秒输出一次统计

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      clearInterval(statsInterval);
    };
  }, [
    connectionStatus.isConnected,
    recordingConfig.isRecording,
    recordingConfig.interval,
    testModeConfig.enabled,
    readTemperatureData
  ]);

  return {
    readings,
    rawDataReadings,
    isReading: isReading || testModeConfig.enabled,
    addReading,
    addMultipleReadings,
    clearReadings,
    replaceReadings
  };
}