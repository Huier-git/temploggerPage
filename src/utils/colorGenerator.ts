/**
 * 动态颜色生成器 - 为数据可视化生成最佳颜色方案
 * Dynamic Color Generator - Generate optimal color schemes for data visualization
 */

export interface ColorConfig {
  hue: number;        // 色相 (0-360)
  saturation: number; // 饱和度 (0-100)
  lightness: number;  // 明度 (0-100)
  hex: string;        // HEX颜色值
  rgb: string;        // RGB颜色值
}

export interface ColorScheme {
  colors: ColorConfig[];
  metadata: {
    totalColors: number;
    hueStep: number;
    averageContrast: number;
    scheme: string;
  };
}

/**
 * HSL转RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 1/6) {
    r = c; g = x; b = 0;
  } else if (1/6 <= h && h < 2/6) {
    r = x; g = c; b = 0;
  } else if (2/6 <= h && h < 3/6) {
    r = 0; g = c; b = x;
  } else if (3/6 <= h && h < 4/6) {
    r = 0; g = x; b = c;
  } else if (4/6 <= h && h < 5/6) {
    r = x; g = 0; b = c;
  } else if (5/6 <= h && h < 1) {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

/**
 * RGB转HEX
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase()}`;
}

/**
 * 计算两个颜色之间的对比度
 */
function calculateContrast(color1: ColorConfig, color2: ColorConfig): number {
  // 使用色相差异作为主要对比度指标
  const hueDiff = Math.abs(color1.hue - color2.hue);
  const hueDistance = Math.min(hueDiff, 360 - hueDiff);
  
  // 饱和度和明度差异作为辅助指标
  const satDiff = Math.abs(color1.saturation - color2.saturation);
  const lightDiff = Math.abs(color1.lightness - color2.lightness);
  
  // 综合对比度评分 (0-100)
  return (hueDistance / 180) * 70 + (satDiff / 100) * 15 + (lightDiff / 100) * 15;
}

/**
 * 优化颜色分布 - 确保相邻颜色有足够的区分度
 */
function optimizeColorDistribution(colors: ColorConfig[], minContrast: number = 25): ColorConfig[] {
  const optimized = [...colors];
  let iterations = 0;
  const maxIterations = 50;

  while (iterations < maxIterations) {
    let improved = false;
    
    for (let i = 0; i < optimized.length; i++) {
      for (let j = i + 1; j < optimized.length; j++) {
        const contrast = calculateContrast(optimized[i], optimized[j]);
        
        if (contrast < minContrast) {
          // 调整色相以增加对比度
          const adjustment = (minContrast - contrast) * 2;
          optimized[j].hue = (optimized[j].hue + adjustment) % 360;
          
          // 重新计算RGB和HEX
          const [r, g, b] = hslToRgb(optimized[j].hue, optimized[j].saturation, optimized[j].lightness);
          optimized[j].hex = rgbToHex(r, g, b);
          optimized[j].rgb = `rgb(${r}, ${g}, ${b})`;
          
          improved = true;
        }
      }
    }
    
    if (!improved) break;
    iterations++;
  }

  return optimized;
}

/**
 * 生成动态颜色方案
 * @param channelCount 通道数量 (1-16)
 * @param options 可选配置
 */
export function generateDynamicColors(
  channelCount: number,
  options: {
    saturationRange?: [number, number];
    lightnessRange?: [number, number];
    startHue?: number;
    scheme?: 'uniform' | 'golden' | 'fibonacci' | 'optimized';
    avoidColors?: string[]; // 避免的颜色区域，如 ['red', 'green'] 
  } = {}
): ColorScheme {
  // 参数验证和默认值
  const count = Math.max(1, Math.min(16, Math.round(channelCount)));
  const {
    saturationRange = [65, 90],
    lightnessRange = [50, 80],
    startHue = 0,
    scheme = 'optimized',
    avoidColors = []
  } = options;

  const colors: ColorConfig[] = [];
  
  // 根据不同方案计算色相分布
  let hueStep: number;
  let hueOffsets: number[] = [];

  switch (scheme) {
    case 'golden':
      // 黄金比例分布 (137.5度间隔)
      hueStep = 137.5;
      hueOffsets = Array.from({ length: count }, (_, i) => (startHue + i * hueStep) % 360);
      break;
      
    case 'fibonacci':
      // 斐波那契螺旋分布
      const phi = (1 + Math.sqrt(5)) / 2;
      hueStep = 360 / phi;
      hueOffsets = Array.from({ length: count }, (_, i) => (startHue + i * hueStep) % 360);
      break;
      
    case 'uniform':
      // 均匀分布
      hueStep = 360 / count;
      hueOffsets = Array.from({ length: count }, (_, i) => (startHue + i * hueStep) % 360);
      break;
      
    case 'optimized':
    default:
      // 优化分布 - 根据通道数量选择最佳策略
      if (count <= 6) {
        // 少量通道：使用更大的间隔确保最大区分度
        hueStep = 360 / count;
        const baseOffsets = [0, 60, 120, 180, 240, 300];
        hueOffsets = baseOffsets.slice(0, count).map(h => (h + startHue) % 360);
      } else if (count <= 12) {
        // 中等通道：使用黄金比例
        hueStep = 137.5;
        hueOffsets = Array.from({ length: count }, (_, i) => (startHue + i * hueStep) % 360);
      } else {
        // 大量通道：使用均匀分布
        hueStep = 360 / count;
        hueOffsets = Array.from({ length: count }, (_, i) => (startHue + i * hueStep) % 360);
      }
      break;
  }

  // 生成颜色
  for (let i = 0; i < count; i++) {
    const hue = hueOffsets[i];
    
    // 动态调整饱和度和明度以增加变化
    const saturationVariation = (saturationRange[1] - saturationRange[0]) / Math.max(1, count - 1);
    const lightnessVariation = (lightnessRange[1] - lightnessRange[0]) / Math.max(1, count - 1);
    
    const saturation = saturationRange[0] + (i * saturationVariation) % (saturationRange[1] - saturationRange[0]);
    const lightness = lightnessRange[0] + (i * lightnessVariation) % (lightnessRange[1] - lightnessRange[0]);
    
    // 避免特定颜色区域
    let adjustedHue = hue;
    for (const avoidColor of avoidColors) {
      const avoidRanges: { [key: string]: [number, number] } = {
        'red': [350, 20],
        'green': [90, 150],
        'blue': [210, 270],
        'yellow': [45, 75],
        'purple': [270, 330],
        'orange': [15, 45]
      };
      
      const range = avoidRanges[avoidColor.toLowerCase()];
      if (range) {
        const [start, end] = range;
        if (start > end) {
          // 跨越0度的范围
          if (adjustedHue >= start || adjustedHue <= end) {
            adjustedHue = (adjustedHue + 60) % 360;
          }
        } else {
          // 正常范围
          if (adjustedHue >= start && adjustedHue <= end) {
            adjustedHue = (adjustedHue + 60) % 360;
          }
        }
      }
    }

    const [r, g, b] = hslToRgb(adjustedHue, saturation, lightness);
    const hex = rgbToHex(r, g, b);
    const rgb = `rgb(${r}, ${g}, ${b})`;

    colors.push({
      hue: adjustedHue,
      saturation,
      lightness,
      hex,
      rgb
    });
  }

  // 优化颜色分布以确保足够的对比度
  const optimizedColors = optimizeColorDistribution(colors, count > 8 ? 20 : 25);

  // 计算平均对比度
  let totalContrast = 0;
  let contrastPairs = 0;
  for (let i = 0; i < optimizedColors.length; i++) {
    for (let j = i + 1; j < optimizedColors.length; j++) {
      totalContrast += calculateContrast(optimizedColors[i], optimizedColors[j]);
      contrastPairs++;
    }
  }
  const averageContrast = contrastPairs > 0 ? totalContrast / contrastPairs : 0;

  return {
    colors: optimizedColors,
    metadata: {
      totalColors: count,
      hueStep: hueStep,
      averageContrast: Math.round(averageContrast * 100) / 100,
      scheme
    }
  };
}

/**
 * 预设颜色方案
 */
export const PRESET_COLOR_SCHEMES = {
  // 经典16色方案 - 高对比度
  classic16: [
    '#FF0040', '#FF4500', '#FF8C00', '#FFD700', '#ADFF2F', '#00FF40',
    '#00FF80', '#00FFFF', '#0080FF', '#0040FF', '#4000FF', '#8000FF',
    '#C000FF', '#FF00C0', '#FF0080', '#FF6B9D'
  ],
  
  // 专业数据可视化方案
  professional: [
    '#E31A1C', '#FF7F00', '#FDBF6F', '#33A02C', '#B2DF8A', '#1F78B4',
    '#A6CEE3', '#6A3D9A', '#CAB2D6', '#FB9A99', '#FFFF99', '#B15928',
    '#FF1493', '#00CED1', '#32CD32', '#FF6347'
  ],
  
  // 色盲友好方案
  colorblindFriendly: [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
    '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
    '#98df8a', '#ff9896', '#c5b0d5', '#c49c94'
  ]
};

/**
 * 获取预设颜色方案
 */
export function getPresetColors(scheme: keyof typeof PRESET_COLOR_SCHEMES, count: number): string[] {
  const colors = PRESET_COLOR_SCHEMES[scheme];
  if (count <= colors.length) {
    return colors.slice(0, count);
  }
  
  // 如果需要更多颜色，使用动态生成补充
  const additional = generateDynamicColors(count - colors.length, {
    startHue: 0,
    scheme: 'optimized'
  });
  
  return [...colors, ...additional.colors.map(c => c.hex)];
}

/**
 * 验证颜色方案质量
 */
export function validateColorScheme(colors: string[]): {
  isValid: boolean;
  minContrast: number;
  averageContrast: number;
  issues: string[];
} {
  const issues: string[] = [];
  const colorConfigs: ColorConfig[] = [];
  
  // 转换为ColorConfig格式进行分析
  for (const color of colors) {
    // 简化的HEX转HSL转换（这里可以使用更精确的转换）
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    // 简化的RGB转HSL
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const lightness = (max + min) / 2 * 100;
    const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness / 100 - 1)) * 100;
    
    let hue = 0;
    if (max !== min) {
      const delta = max - min;
      if (max === r / 255) hue = ((g / 255 - b / 255) / delta + (g < b ? 6 : 0)) / 6 * 360;
      else if (max === g / 255) hue = ((b / 255 - r / 255) / delta + 2) / 6 * 360;
      else hue = ((r / 255 - g / 255) / delta + 4) / 6 * 360;
    }
    
    colorConfigs.push({
      hue,
      saturation,
      lightness,
      hex: color,
      rgb: `rgb(${r}, ${g}, ${b})`
    });
  }
  
  // 计算对比度
  const contrasts: number[] = [];
  for (let i = 0; i < colorConfigs.length; i++) {
    for (let j = i + 1; j < colorConfigs.length; j++) {
      contrasts.push(calculateContrast(colorConfigs[i], colorConfigs[j]));
    }
  }
  
  const minContrast = Math.min(...contrasts);
  const averageContrast = contrasts.reduce((a, b) => a + b, 0) / contrasts.length;
  
  // 验证规则
  if (minContrast < 15) {
    issues.push('某些颜色对比度过低，可能难以区分');
  }
  
  if (averageContrast < 25) {
    issues.push('整体颜色对比度偏低');
  }
  
  if (colors.length > 12 && minContrast < 20) {
    issues.push('颜色数量较多时建议提高最小对比度');
  }
  
  return {
    isValid: issues.length === 0,
    minContrast: Math.round(minContrast * 100) / 100,
    averageContrast: Math.round(averageContrast * 100) / 100,
    issues
  };
}