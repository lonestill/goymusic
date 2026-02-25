import React, { useState, useEffect, useRef } from 'react';
import { imageQueue } from '../../utils/imageQueue';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholder?: React.ReactNode;
  maxRetries?: number;
}

export const LazyImage: React.FC<LazyImageProps> = ({ 
  src, 
  alt, 
  className, 
  placeholder, 
  maxRetries = 3,
  ...props 
}) => {
  const [isIntersecting, setIntersecting] = useState(false);
  const [isAllowedToLoad, setIsAllowedToLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);
  const containerRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<any>(null);

  useEffect(() => {
    setCurrentSrc(src);
    setErrorCount(0);
    setIsLoaded(false);
    setIsAllowedToLoad(false);
  }, [src]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } 
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  // When intersection is detected, request slot from global queue
  useEffect(() => {
    if (isIntersecting && !isAllowedToLoad && !isLoaded) {
      imageQueue.enqueue(src || '', () => {
        setIsAllowedToLoad(true);
      });
    }
  }, [isIntersecting, isAllowedToLoad, isLoaded, src]);

  const handleError = () => {
    if (errorCount < maxRetries) {
      // 5s, 10s, 20s
      const delays = [5000, 10000, 20000];
      const delay = delays[errorCount] || 20000;
      
      console.warn(`[LazyImage] 429 or Load Error. Retrying in ${delay/1000}s... (${errorCount + 1}/${maxRetries})`);

      retryTimeoutRef.current = setTimeout(() => {
        setErrorCount(prev => prev + 1);
        if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
          const separator = src.includes('?') ? '&' : '?';
          setCurrentSrc(`${src}${separator}retry=${Date.now()}`);
        }
      }, delay);
    }
  };

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {isAllowedToLoad ? (
        <img
          src={currentSrc}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={handleError}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            display: 'block'
          }}
          {...props}
        />
      ) : null}
      {!isLoaded && placeholder}
    </div>
  );
};
