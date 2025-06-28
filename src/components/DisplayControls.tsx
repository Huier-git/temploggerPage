import React from 'react';
import { Monitor, Clock, Grid, Eye, BarChart3, TrendingUp, Upload } from 'lucide-react';
import { DisplayConfig } from '../types';

interface DisplayControlsProps {
  config: DisplayConfig;
  onConfigChange: (config: DisplayConfig) => void;
  onImportData?: (file: File) => void;
}

export default function DisplayControls({ config, onConfigChange, onImportData }: DisplayControlsProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleModeChange = (mode: 'full' | 'sliding') => {
    onConfigChange({
      ...config,
      mode
    });
  };

  const handleViewModeChange = (viewMode: 'combined' | 'individual') => {
    onConfigChange({
      ...config,
      viewMode
    });
  };

  const handleTimeWindowChange = (timeWindow: number) => {
    onConfigChange({
      ...config,
      timeWindow
    });
  };

  const handleToggleGrid = () => {
    onConfigChange({
      ...config,
      showGrid: !config.showGrid
    });
  };

  const handleToggleLegend = () => {
    onConfigChange({
      ...config,
      showLegend: !config.showLegend
    });
  };

  const handleToggleRelativeTime = () => {
    onConfigChange({
      ...config,
      relativeTime: !config.relativeTime
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImportData) {
      onImportData(file);
      // 清空文件输入，允许重复选择同一文件
      event.target.value = '';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Monitor className="w-4 h-4 text-cyan-400" />
        <h2 className="text-lg font-semibold text-white">显示设置</h2>
      </div>

      <div className="space-y-4">
        {/* 视图模式选择 - 紧凑 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <BarChart3 className="w-4 h-4 inline mr-1" />
            视图模式
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleViewModeChange('combined')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                config.viewMode === 'combined'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              综合视图
            </button>
            <button
              onClick={() => handleViewModeChange('individual')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                config.viewMode === 'individual'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              分析视图
            </button>
          </div>
        </div>

        {/* 数据范围和时间设置 - 紧凑网格 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              数据范围
            </label>
            <div className="flex rounded-lg border border-gray-600 overflow-hidden">
              <button
                onClick={() => handleModeChange('full')}
                className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
                  config.mode === 'full'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => handleModeChange('sliding')}
                className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
                  config.mode === 'sliding'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                窗口
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              时间窗口
            </label>
            <select
              value={config.timeWindow}
              onChange={(e) => handleTimeWindowChange(parseInt(e.target.value))}
              disabled={config.mode === 'full'}
              className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value={1}>1分钟</option>
              <option value={5}>5分钟</option>
              <option value={10}>10分钟</option>
              <option value={15}>15分钟</option>
              <option value={30}>30分钟</option>
              <option value={60}>1小时</option>
            </select>
          </div>
        </div>

        {/* 显示选项 - 紧凑 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            显示选项
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleToggleGrid}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                config.showGrid
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Grid className="w-3 h-3" />
              网格
            </button>

            <button
              onClick={handleToggleLegend}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                config.showLegend
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Eye className="w-3 h-3" />
              图例
            </button>

            <button
              onClick={handleToggleRelativeTime}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                config.relativeTime
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Clock className="w-3 h-3" />
              相对时间
            </button>
          </div>
        </div>

        {/* CSV导入功能 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            数据导入
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入CSV文件
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="text-xs text-gray-400 mt-1">
            支持导入CSV格式的温度数据文件
          </div>
        </div>
      </div>
    </div>
  );
}