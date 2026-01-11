import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface OnboardingStep {
    target: string;
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingProps {
    steps: OnboardingStep[];
    onComplete: () => void;
    onSkip: () => void;
}

export default function Onboarding({ steps, onComplete, onSkip }: OnboardingProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        updateTargetPosition();
        window.addEventListener('resize', updateTargetPosition);
        return () => window.removeEventListener('resize', updateTargetPosition);
    }, [currentStep]);

    const updateTargetPosition = () => {
        const step = steps[currentStep];
        if (!step) return;

        const element = document.querySelector(step.target);
        if (element) {
            const rect = element.getBoundingClientRect();
            setTargetRect(rect);
        }
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentStep(currentStep + 1);
                setIsAnimating(false);
            }, 300);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentStep(currentStep - 1);
                setIsAnimating(false);
            }, 300);
        }
    };

    const getTooltipPosition = () => {
        if (!targetRect || !tooltipRef.current) return {};

        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const step = steps[currentStep];
        const position = step.position || 'bottom';
        const padding = 20;

        let top = 0;
        let left = 0;

        switch (position) {
            case 'top':
                top = targetRect.top - tooltipRect.height - padding;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'bottom':
                top = targetRect.bottom + padding;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.left - tooltipRect.width - padding;
                break;
            case 'right':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.right + padding;
                break;
        }

        // Keep tooltip within viewport
        const maxLeft = window.innerWidth - tooltipRect.width - 20;
        const maxTop = window.innerHeight - tooltipRect.height - 20;
        left = Math.max(20, Math.min(left, maxLeft));
        top = Math.max(20, Math.min(top, maxTop));

        return { top: `${top}px`, left: `${left}px` };
    };

    if (!steps.length || currentStep >= steps.length) return null;

    const step = steps[currentStep];

    return (
        <div className="fixed inset-0 z-100">
            {/* Overlay with spotlight effect using SVG mask */}
            {targetRect && (
                <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                    <defs>
                        <mask id="spotlight-mask">
                            <rect x="0" y="0" width="100%" height="100%" fill="white" />
                            <rect
                                x={targetRect.left - 8}
                                y={targetRect.top - 8}
                                width={targetRect.width + 16}
                                height={targetRect.height + 16}
                                rx="12"
                                fill="black"
                            />
                        </mask>
                    </defs>
                    <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        fill="rgba(0, 0, 0, 0.85)"
                        mask="url(#spotlight-mask)"
                        className="transition-opacity duration-500"
                    />
                </svg>
            )}
            
            {/* Animated border around target */}
            {targetRect && (
                <div
                    className="absolute transition-all duration-500 ease-out pointer-events-none"
                    style={{
                        top: `${targetRect.top - 8}px`,
                        left: `${targetRect.left - 8}px`,
                        width: `${targetRect.width + 16}px`,
                        height: `${targetRect.height + 16}px`,
                        borderRadius: '12px',
                        border: '3px solid #f97316',
                        boxShadow: '0 0 0 4px rgba(249, 115, 22, 0.2), 0 0 20px rgba(249, 115, 22, 0.4)',
                        animation: 'pulse-border 2s ease-in-out infinite'
                    }}
                />
            )}

            {/* Tooltip */}
            {targetRect && (
                <div
                    ref={tooltipRef}
                    className={`absolute transition-all duration-500 ease-out pointer-events-auto ${
                        isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                    }`}
                    style={getTooltipPosition()}
                >
                    <div className="bg-bg-card border border-white/20 rounded-xl shadow-2xl p-6 max-w-sm">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-semibold text-brand-orange">
                                        ÉTAPE {currentStep + 1}/{steps.length}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-white">{step.title}</h3>
                            </div>
                            <button
                                onClick={onSkip}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                            {step.description}
                        </p>

                        {/* Progress bar */}
                        <div className="mb-6">
                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="h-full bg-linear-to-r from-orange-500 to-amber-500 transition-all duration-500"
                                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handlePrev}
                                disabled={currentStep === 0}
                                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="size-4" />
                                Précédent
                            </button>

                            <button
                                onClick={onSkip}
                                className="text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Passer
                            </button>

                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 bg-brand-orange hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                            >
                                {currentStep === steps.length - 1 ? 'Terminer' : 'Suivant'}
                                <ChevronRight className="size-4" />
                            </button>
                        </div>
                    </div>

                    {/* Arrow indicator */}
                    <div
                        className={`absolute w-0 h-0 border-8 ${
                            step.position === 'top'
                                ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-t-bg-card border-x-transparent border-b-transparent'
                                : step.position === 'left'
                                ? 'right-0 top-1/2 -translate-y-1/2 translate-x-full border-l-bg-card border-y-transparent border-r-transparent'
                                : step.position === 'right'
                                ? 'left-0 top-1/2 -translate-y-1/2 -translate-x-full border-r-bg-card border-y-transparent border-l-transparent'
                                : 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-b-bg-card border-x-transparent border-t-transparent'
                        }`}
                    />
                </div>
            )}

            {/* CSS Animation */}
            <style>{`
                @keyframes pulse-border {
                    0%, 100% {
                        border-color: #f97316;
                        box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.2), 0 0 20px rgba(249, 115, 22, 0.4);
                    }
                    50% {
                        border-color: #fb923c;
                        box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.3), 0 0 30px rgba(249, 115, 22, 0.6);
                    }
                }
            `}</style>
        </div>
    );
}
