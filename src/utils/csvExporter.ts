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
    sessionInfo: {
      pauseResumeEvents: Array<{
        timestamp: string;
        action: 'pause' | 'resume';
        duration?: number;
        reason?: string;
      }>;
      totalActiveDuration: number;
      totalPauseDuration: number;
    };
    calibrationInfo?: {
      hasCalibrationData: boolean;
      calibratedChannels: number[];
      calibrationAppliedAt?: string;
    };
  };
}

function processSessionEvents(sessionEvents: Array<{
  timestamp: number;
  action: 'start' | 'pause' | 'resume' | 'stop';
  reason: string;
}>): {
  pauseResumeEvents: Array<{
    timestamp: string;
    action: 'pause' | 'resume';
    duration?: number;
    reason?: string;
  }>;
  totalActiveDuration: number;
  totalPauseDuration: number;
} {
  if (sessionEvents.length === 0) {
    return {
      pauseResumeEvents: [],
      totalActiveDuration: 0,
      totalPauseDuration: 0
    };
  }

  const events: Array<{
    timestamp: string;
    action: 'pause' | 'resume';
    duration?: number;
    reason?: string;
  }> = [];
  
  let totalActiveDuration = 0;
  let totalPauseDuration = 0;
  let lastActiveStart = 0;
  let lastPauseStart = 0;

  for (let i = 0; i < sessionEvents.length; i++) {
    const event = sessionEvents[i];
    const nextEvent = sessionEvents[i + 1];

    switch (event.action) {
      case 'start':
      case 'resume':
        lastActiveStart = event.timestamp;
        if (event.action === 'resume') {
          if (lastPauseStart > 0) {
            const pauseDuration = Math.round((event.timestamp - lastPauseStart) / 1000);
            totalPauseDuration += pauseDuration;
            
            const lastPauseEvent = events[events.length - 1];
            if (lastPauseEvent && lastPauseEvent.action === 'pause') {
              lastPauseEvent.duration = pauseDuration;
            }
          }
          
          events.push({
            timestamp: new Date(event.timestamp).toISOString(),
            action: 'resume',
            reason: event.reason
          });
        }
        break;

      case 'pause':
      case 'stop':
        if (lastActiveStart > 0) {
          const activeDuration = Math.round((event.timestamp - lastActiveStart) / 1000);
          totalActiveDuration += activeDuration;
        }
        
        if (event.action === 'pause') {
          lastPauseStart = event.timestamp;
          events.push({
            timestamp: new Date(event.timestamp).toISOString(),
            action: 'pause',
            reason: event.reason
          });
        }
        break;
    }
  }

  const lastEvent = sessionEvents[sessionEvents.length - 1];
  if (lastEvent.action === 'start' || lastEvent.action === 'resume') {
    const now = Date.now();
    const activeDuration = Math.round((now - lastEvent.timestamp) / 1000);
    totalActiveDuration += activeDuration;
  }

  return {
    pauseResumeEvents: events,
    totalActiveDuration: Math.max(0, totalActiveDuration),
    totalPauseDuration
  };
}

export function exportToCSV(data: ExportData, prefix: string = ''): void {
  const { readings, metadata } = data;
  
  let csvContent = '';
  
  // Add metadata header
  csvContent += '# Temperature Monitoring Data Export\n';
  csvContent += `# Export Date: ${metadata.exportDate}\n`;
  csvContent += `# Device Port: ${metadata.deviceInfo.port || 'N/A'}\n`;
  csvContent += `# Baud Rate: ${metadata.deviceInfo.baudRate}\n`;
  
  // Register configuration info
  if (metadata.deviceInfo.customRegisters && metadata.deviceInfo.customRegisters.length > 0) {
    csvContent += `# Custom Registers: ${metadata.deviceInfo.customRegisters.join(';')}\n`;
  } else {
    csvContent += `# Start Register: ${metadata.deviceInfo.startRegister} (${metadata.deviceInfo.registerCount} consecutive)\n`;
  }
  
  csvContent += `# Recording Frequency: ${(1 / metadata.recordingConfig.interval).toFixed(1)} Hz\n`;
  csvContent += `# Total Records: ${metadata.totalReadings}\n`;
  csvContent += `# Time Range: ${metadata.timeRange.start} to ${metadata.timeRange.end}\n`;
  
  // Add calibration information
  if (metadata.calibrationInfo?.hasCalibrationData) {
    csvContent += '#\n';
    csvContent += '# Calibration Information:\n';
    csvContent += `# Calibrated Channels: ${metadata.calibrationInfo.calibratedChannels.join(', ')}\n`;
    if (metadata.calibrationInfo.calibrationAppliedAt) {
      csvContent += `# Calibration Applied At: ${metadata.calibrationInfo.calibrationAppliedAt}\n`;
    }
    csvContent += '# Note: Both original and calibrated temperature values are included\n';
  }
  
  // Add session information
  if (metadata.sessionInfo.pauseResumeEvents.length > 0) {
    csvContent += '#\n';
    csvContent += '# Session Information:\n';
    csvContent += `# Total Active Recording Duration: ${Math.round(metadata.sessionInfo.totalActiveDuration)} seconds\n`;
    csvContent += `# Total Pause Duration: ${Math.round(metadata.sessionInfo.totalPauseDuration)} seconds\n`;
    csvContent += `# Number of Pause/Resume Events: ${metadata.sessionInfo.pauseResumeEvents.length}\n`;
    csvContent += '#\n';
    csvContent += '# Pause/Resume Events:\n';
    
    metadata.sessionInfo.pauseResumeEvents.forEach((event, index) => {
      if (event.action === 'pause') {
        csvContent += `# ${index + 1}. Paused at: ${event.timestamp}`;
        if (event.duration) {
          csvContent += ` (Duration: ${event.duration} seconds)`;
        }
        if (event.reason) {
          csvContent += ` - Reason: ${event.reason}`;
        }
        csvContent += '\n';
      } else {
        csvContent += `# ${index + 1}. Resumed at: ${event.timestamp}`;
        if (event.reason) {
          csvContent += ` - Reason: ${event.reason}`;
        }
        csvContent += '\n';
      }
    });
  } else {
    csvContent += '# Session Information: Continuous recording (no user-initiated pauses)\n';
  }
  
  csvContent += '#\n';
  
  // 检查是否有校准数据
  const hasCalibrationData = readings.some(reading => reading.calibratedTemperature !== undefined);
  
  // Add column headers
  if (hasCalibrationData) {
    csvContent += 'Timestamp,Channel,Temperature_C,Raw_Value,Calibrated_Temperature_C\n';
  } else {
    csvContent += 'Timestamp,Channel,Temperature_C,Raw_Value\n';
  }
  
  // Add data rows
  readings.forEach(reading => {
    if (hasCalibrationData) {
      const calibratedTemp = reading.calibratedTemperature !== undefined 
        ? reading.calibratedTemperature.toFixed(1) 
        : reading.temperature.toFixed(1);
      csvContent += `${reading.timestamp},${reading.channel},${reading.temperature.toFixed(1)},${reading.rawValue},${calibratedTemp}\n`;
    } else {
      csvContent += `${reading.timestamp},${reading.channel},${reading.temperature.toFixed(1)},${reading.rawValue}\n`;
    }
  });
  
  // Generate filename
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  
  let filename = `${prefix}temperature_data_${dateStr}_${timeStr}`;
  
  if (metadata.deviceInfo.customRegisters && metadata.deviceInfo.customRegisters.length > 0) {
    filename += `_custom_registers_${metadata.deviceInfo.customRegisters.length}`;
  } else {
    filename += `_reg${metadata.deviceInfo.startRegister}-${metadata.deviceInfo.startRegister + metadata.deviceInfo.registerCount - 1}`;
  }
  
  filename += `_${(1 / metadata.recordingConfig.interval).toFixed(1)}Hz`;
  filename += `_${metadata.totalReadings}records`;
  
  if (metadata.sessionInfo.pauseResumeEvents.length > 0) {
    const pauseCount = metadata.sessionInfo.pauseResumeEvents.filter(e => e.action === 'pause').length;
    filename += `_${pauseCount}pauses`;
  }
  
  // 如果有校准数据，在文件名中标注
  if (hasCalibrationData) {
    filename += '_calibrated';
  }
  
  filename += '.csv';
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function prepareExportData(
  readings: TemperatureReading[],
  serialConfig: SerialConfig,
  recordingConfig: RecordingConfig,
  sessionEvents: Array<{
    timestamp: number;
    action: 'start' | 'pause' | 'resume' | 'stop';
    reason: string;
  }> = []
): ExportData {
  const sortedReadings = readings.sort((a, b) => a.timestamp - b.timestamp);
  const sessionInfo = processSessionEvents(sessionEvents);
  
  // 检查校准信息
  const hasCalibrationData = sortedReadings.some(reading => reading.calibratedTemperature !== undefined);
  const calibratedChannels = hasCalibrationData 
    ? [...new Set(sortedReadings
        .filter(reading => reading.calibratedTemperature !== undefined)
        .map(reading => reading.channel)
      )].sort((a, b) => a - b)
    : [];
  
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
      },
      sessionInfo,
      calibrationInfo: {
        hasCalibrationData,
        calibratedChannels,
        calibrationAppliedAt: hasCalibrationData ? new Date().toISOString() : undefined
      }
    }
  };
}