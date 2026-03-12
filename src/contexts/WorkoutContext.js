import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const WorkoutContext = createContext(null);

export function WorkoutProvider({ children }) {
    const [activeWorkout, setActiveWorkout] = useState(null); // { routine, exerciseLogs, startTime }
    const [isExpanded, setIsExpanded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [restTimer, setRestTimer] = useState(null);
    const [restDuration, setRestDuration] = useState(0);
    const elapsedRef = useRef(0);

    const startWorkout = useCallback((routine, exerciseLogs) => {
        setActiveWorkout({
            routine,
            exerciseLogs,
            startTime: Date.now(),
        });
        setIsExpanded(true);
        setIsModalOpen(false);
    }, []);

    const minimizeWorkout = useCallback((exerciseLogs) => {
        if (activeWorkout) {
            setActiveWorkout(prev => ({ ...prev, exerciseLogs }));
            setIsExpanded(false);
        }
    }, [activeWorkout]);

    const expandWorkout = useCallback(() => {
        setIsExpanded(true);
    }, []);

    const endWorkout = useCallback(() => {
        setActiveWorkout(null);
        setIsExpanded(false);
        setIsModalOpen(false);
        setRestTimer(null);
        setRestDuration(0);
        elapsedRef.current = 0;
    }, []);

    const updateExerciseLogs = useCallback((exerciseLogs) => {
        setActiveWorkout(prev => prev ? { ...prev, exerciseLogs } : null);
    }, []);

    return (
        <WorkoutContext.Provider value={{
            activeWorkout,
            isExpanded,
            isModalOpen,
            setIsModalOpen,
            restTimer,
            setRestTimer,
            restDuration,
            setRestDuration,
            elapsedRef,
            startWorkout,
            minimizeWorkout,
            expandWorkout,
            endWorkout,
            updateExerciseLogs,
        }}>
            {children}
        </WorkoutContext.Provider>
    );
}

export function useWorkout() {
    const ctx = useContext(WorkoutContext);
    if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
    return ctx;
}
