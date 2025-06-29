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
        duration?: number; // pause duration in seconds
      }>;
      totalActiveDuration: number; // total active recording time in seconds
      totalPauseDuration: number; // total pause time in seconds
    };
  };
}

// Detect pause/resume events in the data
function detectPauseResumeEvents(readings: TemperatureReading[], recordingInterval: number): {
  pauseResumeEvents: Array<{
    timestamp: string;
    action: 'pause' | 'resume';
    duration?: number;
  }>;
  totalActiveDuration: number;
  totalPauseDuration: number;
} {
  if (readings.length < 2) {
    return {
      pauseResumeEvents: [],
      totalActiveDuration: 0,
      totalPauseDuration: 0
    };
  }

  const sortedReadings = readings.sort((a, b) => a.timestamp - b.timestamp);
  const events: Array<{
    timestamp: string;
    action: 'pause' | 'resume';
    duration?: number;
  }> = [];
  
  let totalPauseDuration = 0;
  const expectedInterval = recordingInterval * 1000; // Convert to milliseconds
  const pauseThreshold = expectedInterval * 3; // Consider a gap > 3x interval as a pause
  
  for (let i = 1; i < sortedReadings.length; i++) {
    const currentReading = sortedReadings[i];
    const previousReading = sortedReadings[i - 1];
    const gap = currentReading.timestamp - previousReading.timestamp;
    
    if (gap > pauseThreshold) {
      // Detected a pause
      const pauseDuration = Math.round(gap / 1000); // Convert to seconds
      totalPauseDuration += pauseDuration;
      
      // Add pause event
      events.push({
        timestamp: new Date(previousReading.timestamp).toISOString(),
        action: 'pause',
        duration: pauseDuration
      });
      
      // Add resume event
      events.push({
        timestamp: new Date(currentReading.timestamp).toISOString(),
        action: 'resume'
      });
    }
  }
  
  const totalDuration = (sortedReadings[sortedReadings.length - 1].timestamp - sortedReadings[0].timestamp) / 1000;
  const totalActiveDuration = totalDuration - totalPauseDuration;
  
  return {
    pauseResumeEvents: events,
    totalActiveDuration: Math.max(0, totalActiveDuration),
    totalPauseDuration
  };
}

export function exportToCSV(data: ExportData, prefix: string = ''): void {
  const { readings, metadata } = data;
  
  let csvContent = '';
  
  // Add metadata header in English
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
        csvContent += `# ${index + 1}. Paused at: ${event.timestamp} (Duration: ${event.duration} seconds)\n`;
      } else {
        csvContent += `# ${index + 1}. Resumed at: ${event.timestamp}\n`;
      }
    });
  } else {
    csvContent += '# Session Information: Continuous recording (no pauses detected)\n';
  }
  
  csvContent += '#\n';
  
  // Add column headers in English
  csvContent += 'Timestamp,Channel,Temperature_C,Raw_Value\n';
  
  // Add data rows
  readings.forEach(reading => {
    csvContent += `${reading.timestamp},${reading.channel},${reading.temperature.toFixed(1)},${reading.rawValue}\n`;
  });
  
  // Generate smart filename in English
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  
  let filename = `${prefix}temperature_data_${dateStr}_${timeStr}`;
  
  // Generate descriptive filename based on configuration
  if (metadata.deviceInfo.customRegisters && metadata.deviceInfo.customRegisters.length > 0) {
    filename += `_custom_registers_${metadata.deviceInfo.customRegisters.length}`;
  } else {
    filename += `_reg${metadata.deviceInfo.startRegister}-${metadata.deviceInfo.startRegister + metadata.deviceInfo.registerCount - 1}`;
  }
  
  filename += `_${(1 / metadata.recordingConfig.interval).toFixed(1)}Hz`;
  filename += `_${metadata.totalReadings}records`;
  
  // Add session info to filename if there were pauses
  if (metadata.sessionInfo.pauseResumeEvents.length > 0) {
    filename += `_${metadata.sessionInfo.pauseResumeEvents.length / 2}pauses`;
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
  
  // Clean up URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function prepareExportData(
  readings: TemperatureReading[],
  serialConfig: SerialConfig,
  recordingConfig: RecordingConfig
): ExportData {
  const sortedReadings = readings.sort((a, b) => a.timestamp - b.timestamp);
  const sessionInfo = detectPauseResumeEvents(sortedReadings, recordingConfig.interval);
  
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
      sessionInfo
    }
  };
}