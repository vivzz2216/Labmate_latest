import React, { useEffect, useRef } from 'react';

interface IphoneProps {
  className?: string;
  children?: React.ReactNode;
  scrollContent?: React.ReactNode;
  autoScroll?: boolean;
  scrollSpeed?: number;
}

export function Iphone({ 
  className = '', 
  children,
  scrollContent,
  autoScroll = true,
  scrollSpeed = 50
}: IphoneProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    let scrollPosition = 0;
    let isScrolling = true;

    const scroll = () => {
      if (!isScrolling) return;
      
      scrollPosition += 0.5;
      const maxScroll = container.scrollHeight - container.clientHeight;
      
      if (scrollPosition >= maxScroll) {
        scrollPosition = 0;
      }
      
      container.scrollTop = scrollPosition;
    };

    const interval = setInterval(scroll, scrollSpeed);

    // Pause on hover
    const handleMouseEnter = () => { isScrolling = false; };
    const handleMouseLeave = () => { isScrolling = true; };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      clearInterval(interval);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [autoScroll, scrollSpeed]);

  return (
    <div className={`relative w-[434px] h-[868px] mx-auto ${className}`}>
      {/* iPhone Frame */}
      <div className="absolute inset-0 rounded-[3.5rem] bg-black p-2 shadow-2xl">
        {/* Screen Bezel */}
        <div className="w-full h-full rounded-[3rem] bg-black overflow-hidden relative">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-[30px] bg-black rounded-b-[20px] z-20"></div>
          
          {/* Screen Content */}
          <div 
            ref={screenRef}
            className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative"
          >
            {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-white z-10 flex items-center justify-between px-6 pt-2">
              <div className="text-black text-sm font-semibold">9:41</div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-2 border border-black rounded-sm">
                  <div className="w-3 h-1.5 bg-black rounded-sm m-0.5"></div>
                </div>
                <div className="w-5 h-2.5 border border-black rounded-sm">
                  <div className="w-4 h-2 bg-black rounded-sm m-0.5"></div>
                </div>
                <div className="w-6 h-3 border border-black rounded-sm">
                  <div className="w-5 h-2.5 bg-black rounded-sm m-0.5"></div>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div 
              ref={scrollContainerRef}
              className="w-full h-full overflow-y-auto pt-12"
              style={{ scrollBehavior: 'smooth' }}
            >
              {scrollContent || children || (
                <div className="p-6 space-y-4">
                  <div className="h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl"></div>
                  <div className="h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl"></div>
                  <div className="h-40 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl"></div>
                  <div className="h-32 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl"></div>
                  <div className="h-48 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl"></div>
                  <div className="h-36 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl"></div>
                </div>
              )}
            </div>

            {/* Home Indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/30 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Iphone;

