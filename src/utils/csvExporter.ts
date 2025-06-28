import { TemperatureReading, SerialConfig, RecordingConfig } from '../types';

export interface ExportData {
  readings: TemperatureReading[];
  metadata: {
    exportDate: string;
    deviceInfo: SerialConfig;
    recordingConfig: RecordingConfig;
    totalReadings: number;
    timeRange: {
      start: string;
      end: string;
    };
  };
}

export function exportToCSV(data: ExportData, prefix: string = ''): void {
  const { readings, metadata } = data;
  
  let csvContent = '';
  
  // 添加元数据头部
  csvContent += '# 温度监测数据导出\n';
  csvContent += `# 导出日期: ${metadata.exportDate}\n`;
  csvContent += `# 设备端口: ${metadata.deviceInfo.port}\n`;
  csvContent += `# 波特率: ${metadata.deviceInfo.baudRate}\n`;
  
  // 寄存器配置信息
  if (metadata.deviceInfo.customRegisters && metadata.deviceInfo.customRegisters.length > 0) {
    csvContent += `# 自定义寄存器: ${metadata.deviceInfo.customRegisters.join(';')}\n`;
  } else {
    csvContent += `# 起始寄存器: ${metadata.deviceInfo.startRegister} (连续10个)\n`;
  }
  
  csvContent += `# 记录频率: ${(1 / metadata.recordingConfig.interval).toFixed(1)} Hz\n`;
  csvContent += `# 总记录数: ${metadata.totalReadings}\n`;
  csvContent += `# 时间范围: ${metadata.timeRange.start} 至 ${metadata.timeRange.end}\n`;
  csvContent += '#\n';
  
  // 添加列标题 - 简化格式
  csvContent += 'Timestamp,Channel,Temperature(°C),Raw Value\n';
  
  // 添加数据行
  readings.forEach(reading => {
    csvContent += `${reading.timestamp},${reading.channel},${reading.temperature.toFixed(1)},${reading.rawValue}\n`;
  });
  
  // 生成智能文件名
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  
  let filename = `${prefix}温度数据_${dateStr}_${timeStr}`;
  
  // 根据配置生成描述性文件名
  if (metadata.deviceInfo.customRegisters && metadata.deviceInfo.customRegisters.length > 0) {
    filename += `_自定义寄存器_${metadata.deviceInfo.customRegisters.length}个`;
  } else {
    filename += `_寄存器${metadata.deviceInfo.startRegister}-${metadata.deviceInfo.startRegister + 9}`;
  }
  
  filename += `_${(1 / metadata.recordingConfig.interval).toFixed(1)}Hz`;
  filename += `_${metadata.totalReadings}条记录.csv`;
  
  // 创建并下载文件
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // 清理URL对象
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function prepareExportData(
  readings: TemperatureReading[],
  serialConfig: SerialConfig,
  recordingConfig: RecordingConfig
): ExportData {
  const sortedReadings = readings.sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    readings: sortedReadings,
    metadata: {
      exportDate: new Date().toISOString(),
      deviceInfo: serialConfig,
      recordingConfig,
      totalReadings: readings.length,
      timeRange: {
        start: sortedReadings.length > 0 ? new Date(sortedReadings[0].timestamp).toISOString() : '',
        end: sortedReadings.length > 0 ? new Date(sortedReadings[sortedReadings.length - 1].timestamp).toISOString() : ''
      }
    }
  };
}