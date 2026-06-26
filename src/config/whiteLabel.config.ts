export interface SchoolColors {
  primary: string;
  primaryHover: string;
  secondary: string;
  secondaryHover: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  surfaceDense: string;
}

export interface SchoolConfig {
  name: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  logoSvgBase64: string;
  themePersonality: 'heritage' | 'modern' | 'warm' | 'bold';
}

export const activeSchoolConfig: SchoolConfig = {
  name: process.env.NEXT_PUBLIC_SCHOOL_NAME || "Bright Success College",
  motto: process.env.NEXT_PUBLIC_SCHOOL_MOTTO || "Excellence in Knowledge and Character",
  address: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || "Gaa Baba Eji, Agbale, Ede, Osun State, Nigeria.",
  phone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || "+2348038553156",
  email: process.env.NEXT_PUBLIC_SCHOOL_EMAIL || "brightsuccesscollege01@gmail.com",
  logoSvgBase64: process.env.NEXT_PUBLIC_SCHOOL_LOGO_BASE64 || "",
  themePersonality: (process.env.NEXT_PUBLIC_THEME_PERSONALITY as any) || "modern"
};

export const getThemeColors = (personality: 'heritage' | 'modern' | 'warm' | 'bold'): SchoolColors => {
  switch (personality) {
    case 'heritage':
      return {
        primary: '#be185d', // pink-700
        primaryHover: '#9d174d', // pink-800
        secondary: '#1e3a8a', // blue-900
        secondaryHover: '#172554', // blue-950
        accent: '#f472b6',
        success: '#15803d',
        warning: '#b45309',
        danger: '#b91c1c',
        surfaceDense: '#ffffff'
      };
    case 'warm':
      return {
        primary: '#db2777', // pink-600
        primaryHover: '#be185d',
        secondary: '#0369a1', // sky-700
        secondaryHover: '#075985',
        accent: '#f43f5e',
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        surfaceDense: '#ffffff'
      };
    case 'bold':
      return {
        primary: '#ec4899', // pink-500
        primaryHover: '#db2777',
        secondary: '#2563eb', // blue-600
        secondaryHover: '#1d4ed8',
        accent: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        surfaceDense: '#ffffff'
      };
    case 'modern':
    default:
      return {
        primary: '#ec4899', // Pink-500
        primaryHover: '#db2777', // Pink-600
        secondary: '#0284c7', // Blue-600
        secondaryHover: '#0369a1', // Blue-700
        accent: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        surfaceDense: '#ffffff'
      };
  }
};
