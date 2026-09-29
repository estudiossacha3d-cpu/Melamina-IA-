import React from 'react';

interface MaterialSphereProps {
  color: string;
  roughness?: number; // 0 (shiny) to 1 (matte)
  metalness?: number; // 0 (dielectric) to 1 (metallic)
  opacity?: number;   // 0 (transparent) to 1 (opaque)
  isGlass?: boolean;
  isMirror?: boolean;
  textureUrl?: string | null;
  size?: number; // width & height in px, e.g. 100
  className?: string;
  glow?: boolean;
}

export const MaterialSphere: React.FC<MaterialSphereProps> = ({
  color,
  roughness = 0.4,
  metalness = 0.0,
  opacity = 1.0,
  isGlass = false,
  isMirror = false,
  textureUrl = null,
  size = 110,
  className = '',
  glow = false
}) => {
  // Specular highlight intensity based on roughness
  const highlightOpacity = Math.max(0.15, 1.0 - roughness * 0.85);
  const highlightSize = Math.max(12, Math.round(35 * (1.1 - roughness)));

  // Metalness affects reflection contrast
  const metallicTint = metalness > 0.5;

  return (
    <div 
      className={`relative flex flex-col items-center justify-center shrink-0 select-none group ${className}`}
      style={{ width: size, height: size + (size > 50 ? 12 : size > 30 ? 6 : 4) }}
    >
      {/* 3D Sphere Container */}
      <div 
        className="relative rounded-full overflow-hidden transition-transform duration-200 group-hover:scale-105"
        style={{
          width: size,
          height: size,
          boxShadow: glow 
            ? '0 10px 25px -5px rgba(240, 161, 68, 0.4), 0 0 15px rgba(240, 161, 68, 0.2)' 
            : '0 12px 24px -6px rgba(0, 0, 0, 0.7), inset 0 -4px 8px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Base Layer: Color or Image Texture */}
        {textureUrl ? (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${textureUrl})`,
              filter: `brightness(${0.9 + (1 - roughness) * 0.15}) contrast(${1.0 + metalness * 0.2})`
            }}
          />
        ) : (
          <div 
            className="absolute inset-0"
            style={{ 
              backgroundColor: color,
              opacity: isGlass ? Math.max(0.25, opacity) : 1.0
            }}
          />
        )}

        {/* Glass Internal Refraction & Transparency Grid if Glass */}
        {isGlass && (
          <>
            {/* Checkerboard or background depth to showcase transparency */}
            <div 
              className="absolute inset-0 -z-10 opacity-25"
              style={{
                backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px), radial-gradient(#ffffff 1px, #1a1a1a 1px)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 4px 4px'
              }}
            />
            {/* Glass internal soft caustic & rim reflection */}
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle at 65% 65%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.4) 100%)'
              }}
            />
          </>
        )}

        {/* 3D Diffuse Curvature Lighting (Poly Haven spherical light map) */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: isMirror
              ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(200,220,240,0.5) 25%, rgba(40,50,65,0.85) 50%, rgba(240,245,255,0.9) 75%, rgba(20,25,30,0.95) 100%)'
              : metallicTint
              ? 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 30%, rgba(0,0,0,0.3) 65%, rgba(0,0,0,0.8) 100%)'
              : 'radial-gradient(circle at 34% 28%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.75) 100%)'
          }}
        />

        {/* Bottom Ambient Bounce Light (Rim Light simulating ground reflection) */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 65% 85%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 45%)'
          }}
        />

        {/* Key Specular Highlight (The Poly Haven studio softbox reflection) */}
        <div 
          className="absolute rounded-full pointer-events-none"
          style={{
            top: '18%',
            left: '22%',
            width: `${highlightSize}%`,
            height: `${Math.round(highlightSize * 0.75)}%`,
            transform: 'rotate(-25deg)',
            background: isMirror || metalness > 0.6
              ? 'radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 35%, rgba(255,255,255,0) 75%)'
              : 'radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0) 80%)',
            opacity: highlightOpacity,
            filter: roughness > 0.4 ? `blur(${Math.round(roughness * 5)}px)` : 'none'
          }}
        />

        {/* Outer Fresnel Rim Highlight */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 10px rgba(255, 255, 255, 0.25), inset 0 0 2px rgba(255, 255, 255, 0.5)'
          }}
        />
      </div>

      {/* Realistic Soft Contact Shadow Under the Sphere */}
      <div 
        className="rounded-full blur-[3px] bg-black/60 pointer-events-none -mt-1 transition-all duration-200 group-hover:scale-95 group-hover:opacity-75"
        style={{
          width: Math.round(size * 0.72),
          height: Math.max(6, Math.round(size * 0.12)),
        }}
      />
    </div>
  );
};

export default MaterialSphere;
