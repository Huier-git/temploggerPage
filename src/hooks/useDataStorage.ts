import { useState, useEffect, useCallback } from 'react';
import { TemperatureReading, DataStorageConfig, SerialConfig, RecordingConfig } from '../types';
import { exportToCSV, prepareExportData } from '../utils/csvExporter';

export function useDataStorage() {
  const [config, setConfig] = useState<DataStorageConfig>({
    autoSaveEnabled: false,
    autoSaveInterval: 10, // 默认10分钟
    totalSavedReadings: 0
  });

  const [savedData, setSavedData] = useState<TemperatureReading[]>([]);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // 自动导出功能 - 修改为直接下载CSV
  useEffect(() => {
    // 清除之前的定时器
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      setAutoSaveTimer(null);
    }

    if (!config.autoSaveEnabled) return;

    console.log(`自动导出已启用，间隔: ${config.autoSaveInterval} 分钟`);

    const interval = setInterval(() => {
      // 获取当前数据并自动导出为CSV
      try {
        const currentData = JSON.parse(localStorage.getItem('currentReadings') || '[]');
        const currentSerialConfig = JSON.parse(localStorage.getItem('currentSerialConfig') || '{}');
        const currentRecordingConfig = JSON.parse(localStorage.getItem('currentRecordingConfig') || '{}');
        
        if (currentData.length > 0) {
          // 自动导出CSV
          const exportData = prepareExportData(currentData, currentSerialConfig, currentRecordingConfig);
          exportToCSV(exportData, '自动导出_');
          
          // 更新配置状态
          setConfig(prev => ({
            ...prev,
            totalSavedReadings: currentData.length,
            lastAutoSave: Date.now()
          }));
          
          console.log(`自动导出成功: ${currentData.length} 条数据`);
        }
      } catch (error) {
        console.error('自动导出失败:', error);
      }
    }, config.autoSaveInterval * 60 * 1000);

    setAutoSaveTimer(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [config.autoSaveEnabled, config.autoSaveInterval]);

  // 生成智能文件名
  const generateSaveFileName = useCallback((readings: TemperatureReading[], serialConfig?: SerialConfig, recordingConfig?: RecordingConfig, prefix: string = '') => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    
    let filename = `${prefix}温度数据_${dateStr}_${timeStr}`;
    
    if (serialConfig) {
      if (serialConfig.customRegisters && serialConfig.customRegisters.length > 0) {
        filename += `_自定义寄存器_${serialConfig.customRegisters.length}个`;
      } else {
        filename += `_寄存器${serialConfig.startRegister}`;
      }
    }
    
    if (recordingConfig) {
      const frequency = (1 / recordingConfig.interval).toFixed(1);
      filename += `_${frequency}Hz`;
    }
    
    filename += `_${readings.length}条记录`;
    
    return filename;
  }, []);

  // 修改：保存功能改为直接导出CSV
  const saveData = useCallback((readings: TemperatureReading[], serialConfig?: SerialConfig, recordingConfig?: RecordingConfig) => {
    // 验证数据完整性
    if (!readings || readings.length === 0) {
      console.warn('没有数据需要导出');
      return false;
    }

    // 验证数据格式
    const validReadings = readings.filter(reading => 
      reading && 
      typeof reading.timestamp === 'number' &&
      typeof reading.channel === 'number' &&
      typeof reading.temperature === 'number' &&
      !isNaN(reading.temperature) &&
      reading.channel >= 1 && reading.channel <= 16
    );

    if (validReadings.length === 0) {
      console.error('没有有效的数据可以导出');
      return false;
    }

    if (validReadings.length !== readings.length) {
      console.warn(`过滤了 ${readings.length - validReadings.length} 条无效数据`);
    }

    try {
      // 直接导出为CSV文件
      const exportData = prepareExportData(validReadings, serialConfig, recordingConfig);
      exportToCSV(exportData);
      
      // 保存当前配置供自动导出使用
      if (serialConfig) {
        localStorage.setItem('currentSerialConfig', JSON.stringify(serialConfig));
      }
      if (recordingConfig) {
        localStorage.setItem('currentRecordingConfig', JSON.stringify(recordingConfig));
      }
      localStorage.setItem('currentReadings', JSON.stringify(validReadings));
      
      console.log(`成功导出 ${validReadings.length} 条温度数据为CSV文件`);
      return true;
    } catch (error) {
      console.error('导出数据失败:', error);
      return false;
    }
  }, []);

  const loadData = useCallback((): TemperatureReading[] => {
    try {
      const saved = localStorage.getItem('temperatureData');
      if (!saved) {
        console.log('没有找到保存的数据');
        return [];
      }

      const data = JSON.parse(saved);
      
      // 验证数据结构
      if (!data || !data.readings || !Array.isArray(data.readings)) {
        console.error('保存的数据格式无效');
        return [];
      }

      // 验证数据完整性
      const validReadings = data.readings.filter((reading: any) => 
        reading && 
        typeof reading.timestamp === 'number' &&
        typeof reading.channel === 'number' &&
        typeof reading.temperature === 'number' &&
        !isNaN(reading.temperature) &&
        reading.channel >= 1 && reading.channel <= 16
      );

      if (validReadings.length !== data.readings.length) {
        console.warn(`加载时过滤了 ${data.readings.length - validReadings.length} 条无效数据`);
      }

      console.log(`成功加载 ${validReadings.length} 条温度数据`);
      return validReadings;
    } catch (error) {
      console.error('加载数据失败:', error);
      return [];
    }
  }, []);

  const importFromCSV = useCallback((file: File): Promise<TemperatureReading[]> => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('没有选择文件'));
        return;
      }

      if (!file.name.toLowerCase().endsWith('.csv')) {
        reject(new Error('请选择CSV文件'));
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB 限制
        reject(new Error('文件大小超过限制 (10MB)'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const csv = e.target?.result as string;
          if (!csv) {
            reject(new Error('文件内容为空'));
            return;
          }

          const lines = csv.split('\n').map(line => line.trim()).filter(line => line);
          const readings: TemperatureReading[] = [];
          let dataStartIndex = 0;
          
          // 查找数据开始行 - 支持简化的CSV格式
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            if ((line.includes('timestamp') || line.includes('时间戳')) && line.includes(',')) {
              dataStartIndex = i + 1;
              break;
            }
          }
          
          if (dataStartIndex === 0) {
            // 如果没有找到标题行，假设第一行就是数据
            dataStartIndex = 0;
          }

          let validCount = 0;
          let invalidCount = 0;
          
          for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.startsWith('#')) continue;
            
            const columns = line.split(',').map(col => col.trim());
            
            if (columns.length < 3) {
              invalidCount++;
              continue;
            }
            
            // 支持不同的CSV格式
            let timestamp: number, channel: number, temperature: number, rawValue: number = 0;
            
            if (columns.length >= 4) {
              // 标准格式: Timestamp,Channel,Temperature,RawValue
              [timestamp, channel, temperature, rawValue] = [
                parseInt(columns[0]),
                parseInt(columns[1]),
                parseFloat(columns[2]),
                parseInt(columns[3]) || 0
              ];
            } else {
              // 简化格式: Timestamp,Channel,Temperature
              [timestamp, channel, temperature] = [
                parseInt(columns[0]),
                parseInt(columns[1]),
                parseFloat(columns[2])
              ];
            }
            
            // 验证数据有效性
            if (isNaN(timestamp) || isNaN(channel) || isNaN(temperature) ||
                channel < 1 || channel > 16 || 
                temperature < -273.15 || temperature > 1000) {
              invalidCount++;
              continue;
            }
            
            readings.push({
              timestamp,
              channel,
              temperature,
              rawValue: isNaN(rawValue) ? Math.round(temperature * 10) : rawValue
            });
            validCount++;
          }
          
          if (readings.length === 0) {
            reject(new Error('CSV文件中没有有效的温度数据'));
            return;
          }

          // 按时间戳排序
          readings.sort((a, b) => a.timestamp - b.timestamp);
          
          console.log(`CSV导入完成: ${validCount} 条有效数据, ${invalidCount} 条无效数据`);
          resolve(readings);
        } catch (error) {
          reject(new Error(`CSV解析失败: ${error instanceof Error ? error.message : '未知错误'}`));
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'utf-8');
    });
  }, []);

  // 清理数据功能 - 更新本地存储使用量
  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem('temperatureData');
      localStorage.removeItem('currentReadings');
      localStorage.removeItem('currentSerialConfig');
      localStorage.removeItem('currentRecordingConfig');
      setConfig(prev => ({
        ...prev,
        totalSavedReadings: 0,
        lastAutoSave: undefined
      }));
      setSavedData([]);
      
      // 触发本地存储使用量更新
      window.dispatchEvent(new Event('storage'));
      
      return true;
    } catch (error) {
      console.error('清理数据失败:', error);
      return false;
    }
  }, []);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  return {
    config,
    setConfig,
    saveData,
    loadData,
    importFromCSV,
    clearSavedData,
    savedData,
    setSavedData
  };
}