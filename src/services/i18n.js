import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSettings, saveSettings } from './storage';

// ─── Supported Languages ────────────────────────────
export const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
];

// ─── Translations ───────────────────────────────────
const translations = {
    en: {
        // Common
        save: 'Save', cancel: 'Cancel', done: 'Done', delete: 'Delete', add: 'Add', close: 'Close', search: 'Search', loading: 'Loading...', reset: 'Reset', ok: 'OK',
        // Short tab labels
        tab_dashboard: 'Home', tab_diary: 'Diary', tab_workouts: 'Workouts', tab_advice: 'Advice', tab_profile: 'Profile',
        // Full names
        dashboard: 'Dashboard', diary: 'Food Diary', workouts: 'Workouts', advice: 'Advice', profile: 'Profile',
        // Greetings
        goodMorning: 'Good Morning', goodAfternoon: 'Good Afternoon', goodEvening: 'Good Evening',
        // Dashboard
        dailyCalories: 'Daily Calories', kcalRemaining: 'kcal remaining', steps: 'Steps', stepsGoal: 'steps goal', todayWorkout: "Today's Workout", noWorkout: 'No workout planned', protein: 'PROTEIN', carbs: 'CARBS', fats: 'FATS', carbohydrates: 'CARBOHYDRATES', friendsLeaderboard: 'Friends Leaderboard', seeMore: 'See More →', aiNutritionAssistant: 'AI Nutrition Assistant', aiActive: 'AI ACTIVE', recentWorkouts: 'Recent Workouts', viewAll: 'View All', noWorkoutsYet: 'No workouts yet. Log one to get started!', you: 'YOU',
        // Diary
        foodDiary: 'Food Diary', breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks', addFood: 'Add Food', logFood: 'Log Food', myMeals: 'My Meals', recipes: 'Recipes', addToDiary: 'Add to Diary', noFoodLogged: 'Nothing logged yet', searchFood: 'Search food or ask AI...', addingTo: 'Adding to', meals: 'Meals',
        // Weekdays
        sun: 'SUN', mon: 'MON', tue: 'TUE', wed: 'WED', thu: 'THU', fri: 'FRI', sat: 'SAT',
        // Months
        january: 'January', february: 'February', march: 'March', april: 'April', may: 'May', june: 'June', july: 'July', august: 'August', september: 'September', october: 'October', november: 'November', december: 'December',
        // Workouts
        startWorkout: 'Start Workout', createRoutine: 'Create Routine', exerciseSearch: 'Search exercises...', sets: 'Sets', reps: 'Reps', weight: 'Weight', rest: 'Rest', finishWorkout: 'Finish Workout', activeWorkout: 'Active Workout', noWorkouts: 'No workouts yet', myRoutines: 'MY ROUTINES', workoutHistory: 'WORKOUT HISTORY', noRoutines: 'No Routines Yet', tapToAdd: 'Tap + to create one', workoutActivity: 'Workout Activity', createFirstRoutine: 'Create your first workout routine by tapping the button below', reorder: 'Reorder', start: 'START',
        // Advice
        recipesForYou: 'RECIPES FOR YOU', aiNutrition: 'AI NUTRITION CHAT', askAnything: 'Ask anything about nutrition...', ingredients: 'Ingredients', steps_recipe: 'Steps', saveToRecipes: 'Save to Recipes', quickAdd: 'QUICK ADD',
        // Advice filters
        filterAll: 'All', filterUnder10: 'Under 10 Min', filterNoCook: 'No-Cook', filterHighProtein: 'High Protein', filterPostWorkout: 'Post-Workout',
        // Settings
        settings: 'Settings', themeSettings: 'THEME SETTINGS', darkMode: 'Dark Mode', darkModeSub: 'Switch between light and dark themes', accentColor: 'ACCENT COLOR', aiIntegration: 'AI INTEGRATION', openaiKey: 'OpenAI API Key', geminiKey: 'Gemini API Key', getApiKey: 'Get API key', timezone: 'TIMEZONE', affectsCalendar: 'Affects calendar dates', searchTimezone: 'Search timezone...', recalcTdee: 'Recalculate TDEE', recalcTdeeSub: 'Update maintenance calories based on activity', clearData: 'Clear All Data', clearDataSub: 'Delete all meals, workouts and settings', logOut: 'Log Out', logOutSub: 'Sign out of your account', language: 'LANGUAGE', selectLanguage: 'Select language',
        // Profile
        macroSplit: 'MACRO SPLIT', recalculate: '⟳ RECALCULATE', calorieGoal: 'Calorie Goal', stepGoal: 'Step Goal', currentPlan: 'CURRENT PLAN', level: 'Level', editProfile: 'Edit Profile', dailyBonus: 'Daily Bonus', dailyGoals: 'DAILY GOALS', cut: 'Cut', bulk: 'Bulk', maintain: 'Maintain',
        // Misc
        today: 'Today', kcal: 'kcal', secure: 'SECURE', min: 'min', prepTime: 'Prep',
        snack: 'SNACK', postGym: 'POST-GYM', loadingAi: 'Loading AI suggestion...', deleteRoutine: 'Delete Routine', yesDelete: 'Yes, Delete', no: 'No', exercises: 'Exercises', general: 'General', profilePicture: 'Profile Picture', chooseOption: 'Choose an option', logToDiary: 'Log to Diary',
        tapToLog: 'Tap + to log', areYouSureDelete: 'Are you sure you want to delete', takePhoto: 'Take Photo', chooseFromLibrary: 'Choose from Library', removePhoto: 'Remove Photo', reorder: 'Reorder',
    },
    fr: {
        save: 'Enregistrer', cancel: 'Annuler', done: 'Terminé', delete: 'Supprimer', add: 'Ajouter', close: 'Fermer', search: 'Chercher', loading: 'Chargement...', reset: 'Réinitialiser', ok: 'OK',
        tab_dashboard: 'Accueil', tab_diary: 'Journal', tab_workouts: 'Entraîn.', tab_advice: 'Conseils', tab_profile: 'Profil',
        dashboard: 'Accueil', diary: 'Journal', workouts: 'Entraînements', advice: 'Conseils', profile: 'Profil',
        goodMorning: 'Bonjour', goodAfternoon: 'Bon après-midi', goodEvening: 'Bonsoir',
        dailyCalories: 'Calories', kcalRemaining: 'kcal restantes', steps: 'Pas', stepsGoal: 'objectif', todayWorkout: "Entraînement du jour", noWorkout: 'Aucun entraînement', protein: 'PROTÉINES', carbs: 'GLUCIDES', fats: 'LIPIDES', carbohydrates: 'GLUCIDES', friendsLeaderboard: 'Classement amis', seeMore: 'Voir plus →', aiNutritionAssistant: 'Assistant nutrition IA', aiActive: 'IA ACTIVE', recentWorkouts: 'Entraînements récents', viewAll: 'Tout voir', noWorkoutsYet: 'Aucun entraînement. Commencez !', you: 'VOUS',
        foodDiary: 'Journal alimentaire', breakfast: 'Petit-déj.', lunch: 'Déjeuner', dinner: 'Dîner', snacks: 'Collations', addFood: 'Ajouter', logFood: 'Ajouter', myMeals: 'Mes repas', recipes: 'Recettes', addToDiary: 'Ajouter', noFoodLogged: 'Rien enregistré', searchFood: 'Chercher ou demander à l\'IA...', addingTo: 'Ajouter à', meals: 'Repas',
        sun: 'DIM', mon: 'LUN', tue: 'MAR', wed: 'MER', thu: 'JEU', fri: 'VEN', sat: 'SAM',
        january: 'Janvier', february: 'Février', march: 'Mars', april: 'Avril', may: 'Mai', june: 'Juin', july: 'Juillet', august: 'Août', september: 'Septembre', october: 'Octobre', november: 'Novembre', december: 'Décembre',
        startWorkout: 'Commencer', createRoutine: 'Créer routine', exerciseSearch: 'Chercher exercices...', sets: 'Séries', reps: 'Reps', weight: 'Poids', rest: 'Repos', finishWorkout: 'Terminer', activeWorkout: 'Entraînement actif', noWorkouts: 'Aucun entraînement', myRoutines: 'MES ROUTINES', workoutHistory: 'HISTORIQUE', noRoutines: 'Aucune routine', tapToAdd: 'Appuyez + pour créer', workoutActivity: 'Activité entraînement', createFirstRoutine: 'Créez votre première routine en appuyant ci-dessous', reorder: 'Réorganiser', start: 'DÉMARRER',
        recipesForYou: 'RECETTES POUR VOUS', aiNutrition: 'CHAT NUTRITION IA', askAnything: 'Question sur la nutrition...', ingredients: 'Ingrédients', steps_recipe: 'Étapes', saveToRecipes: 'Sauvegarder', quickAdd: 'AJOUT RAPIDE',
        filterAll: 'Tout', filterUnder10: 'Moins de 10 min', filterNoCook: 'Sans cuisson', filterHighProtein: 'Riche en protéines', filterPostWorkout: 'Post-entraîn.',
        settings: 'Paramètres', themeSettings: 'THÈME', darkMode: 'Mode sombre', darkModeSub: 'Thèmes clair et sombre', accentColor: 'COULEUR D\'ACCENT', aiIntegration: 'INTÉGRATION IA', openaiKey: 'Clé API OpenAI', geminiKey: 'Clé API Gemini', getApiKey: 'Obtenir clé', timezone: 'FUSEAU HORAIRE', affectsCalendar: 'Affecte les dates', searchTimezone: 'Chercher fuseau...', recalcTdee: 'Recalculer TDEE', recalcTdeeSub: 'Mise à jour calories', clearData: 'Effacer données', clearDataSub: 'Supprimer tout', logOut: 'Déconnexion', logOutSub: 'Se déconnecter', language: 'LANGUE', selectLanguage: 'Choisir la langue',
        macroSplit: 'MACROS', recalculate: '⟳ RECALCULER', calorieGoal: 'Objectif cal.', stepGoal: 'Objectif pas', currentPlan: 'PLAN ACTUEL', level: 'Niveau', editProfile: 'Modifier profil', dailyBonus: 'Bonus quotidien', dailyGoals: 'OBJECTIFS', cut: 'Sèche', bulk: 'Prise de masse', maintain: 'Maintien',
        today: 'Aujourd\'hui', kcal: 'kcal', secure: 'SÉCURISÉ', min: 'min', prepTime: 'Prép.',
        snack: 'EN-CAS', postGym: 'APRÈS SPORT', loadingAi: 'Chargement suggestion IA...', deleteRoutine: 'Supprimer routine', yesDelete: 'Oui, supprimer', no: 'Non', exercises: 'Exercices', general: 'Général', profilePicture: 'Photo de profil', chooseOption: 'Choisir une option', logToDiary: 'Ajouter au journal',
        tapToLog: 'Appuyez + pour ajouter', areYouSureDelete: 'Êtes-vous sûr de supprimer', takePhoto: 'Prendre une photo', chooseFromLibrary: 'Choisir de la galerie', removePhoto: 'Supprimer la photo', reorder: 'Réorganiser',
    },
    es: {
        save: 'Guardar', cancel: 'Cancelar', done: 'Hecho', delete: 'Eliminar', add: 'Añadir', close: 'Cerrar', search: 'Buscar', loading: 'Cargando...', reset: 'Restablecer', ok: 'OK',
        tab_dashboard: 'Inicio', tab_diary: 'Diario', tab_workouts: 'Entreno', tab_advice: 'Consejos', tab_profile: 'Perfil',
        dashboard: 'Inicio', diary: 'Diario', workouts: 'Ejercicios', advice: 'Consejos', profile: 'Perfil',
        goodMorning: 'Buenos días', goodAfternoon: 'Buenas tardes', goodEvening: 'Buenas noches',
        dailyCalories: 'Calorías', kcalRemaining: 'kcal restantes', steps: 'Pasos', stepsGoal: 'objetivo', todayWorkout: 'Entreno de hoy', noWorkout: 'Sin entreno', protein: 'PROTEÍNA', carbs: 'CARBOS', fats: 'GRASAS', carbohydrates: 'CARBOHIDRATOS', friendsLeaderboard: 'Clasificación', seeMore: 'Ver más →', aiNutritionAssistant: 'Asistente nutrición IA', aiActive: 'IA ACTIVA', recentWorkouts: 'Entrenos recientes', viewAll: 'Ver todo', noWorkoutsYet: 'Sin entrenos aún. ¡Empieza!', you: 'TÚ',
        foodDiary: 'Diario alimenticio', breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snacks: 'Snacks', addFood: 'Añadir', logFood: 'Registrar', myMeals: 'Mis comidas', recipes: 'Recetas', addToDiary: 'Añadir', noFoodLogged: 'Nada registrado', searchFood: 'Buscar o preguntar a IA...', addingTo: 'Añadiendo a', meals: 'Comidas',
        sun: 'DOM', mon: 'LUN', tue: 'MAR', wed: 'MIÉ', thu: 'JUE', fri: 'VIE', sat: 'SÁB',
        january: 'Enero', february: 'Febrero', march: 'Marzo', april: 'Abril', may: 'Mayo', june: 'Junio', july: 'Julio', august: 'Agosto', september: 'Septiembre', october: 'Octubre', november: 'Noviembre', december: 'Diciembre',
        startWorkout: 'Empezar', createRoutine: 'Crear rutina', exerciseSearch: 'Buscar ejercicios...', sets: 'Series', reps: 'Reps', weight: 'Peso', rest: 'Descanso', finishWorkout: 'Terminar', activeWorkout: 'Entreno activo', noWorkouts: 'Sin entrenos', myRoutines: 'MIS RUTINAS', workoutHistory: 'HISTORIAL', noRoutines: 'Sin rutinas', tapToAdd: 'Pulsa + para crear', workoutActivity: 'Actividad entrenos', createFirstRoutine: 'Crea tu primera rutina con el botón de abajo', reorder: 'Reordenar', start: 'INICIAR',
        recipesForYou: 'RECETAS PARA TI', aiNutrition: 'CHAT NUTRICIÓN IA', askAnything: 'Pregunta sobre nutrición...', ingredients: 'Ingredientes', steps_recipe: 'Pasos', saveToRecipes: 'Guardar', quickAdd: 'AÑADIR RÁPIDO',
        filterAll: 'Todos', filterUnder10: 'Menos de 10 min', filterNoCook: 'Sin cocinar', filterHighProtein: 'Alta proteína', filterPostWorkout: 'Post-entreno',
        settings: 'Ajustes', themeSettings: 'TEMA', darkMode: 'Modo oscuro', darkModeSub: 'Tema claro y oscuro', accentColor: 'COLOR ACENTO', aiIntegration: 'IA', openaiKey: 'Clave API OpenAI', geminiKey: 'Clave API Gemini', getApiKey: 'Obtener clave', timezone: 'ZONA HORARIA', affectsCalendar: 'Afecta fechas', searchTimezone: 'Buscar zona...', recalcTdee: 'Recalcular TDEE', recalcTdeeSub: 'Actualizar calorías', clearData: 'Borrar datos', clearDataSub: 'Eliminar todo', logOut: 'Cerrar sesión', logOutSub: 'Salir', language: 'IDIOMA', selectLanguage: 'Elegir idioma',
        macroSplit: 'MACROS', recalculate: '⟳ RECALCULAR', calorieGoal: 'Meta calórica', stepGoal: 'Meta pasos', currentPlan: 'PLAN', level: 'Nivel', editProfile: 'Editar perfil', dailyBonus: 'Bonus diario', dailyGoals: 'METAS DIARIAS', cut: 'Definición', bulk: 'Volumen', maintain: 'Mantener',
        today: 'Hoy', kcal: 'kcal', secure: 'SEGURO', min: 'min', prepTime: 'Prep.',
        snack: 'SNACK', postGym: 'POST-GYM', loadingAi: 'Cargando sugerencia IA...', deleteRoutine: 'Eliminar rutina', yesDelete: 'Sí, eliminar', no: 'No', exercises: 'Ejercicios', general: 'General', profilePicture: 'Foto de perfil', chooseOption: 'Elige una opción', logToDiary: 'Registrar en diario',
        tapToLog: 'Toca + para añadir', areYouSureDelete: '¿Seguro que quieres eliminar', takePhoto: 'Tomar foto', chooseFromLibrary: 'Elegir de galería', removePhoto: 'Eliminar foto', reorder: 'Reordenar',
    },
    de: {
        save: 'Speichern', cancel: 'Abbrechen', done: 'Fertig', delete: 'Löschen', add: 'Hinzufügen', close: 'Schließen', search: 'Suchen', loading: 'Laden...', reset: 'Zurücksetzen', ok: 'OK',
        tab_dashboard: 'Home', tab_diary: 'Tagebuch', tab_workouts: 'Training', tab_advice: 'Tipps', tab_profile: 'Profil',
        dashboard: 'Übersicht', diary: 'Tagebuch', workouts: 'Training', advice: 'Beratung', profile: 'Profil',
        goodMorning: 'Guten Morgen', goodAfternoon: 'Guten Tag', goodEvening: 'Guten Abend',
        dailyCalories: 'Kalorien', kcalRemaining: 'kcal übrig', steps: 'Schritte', stepsGoal: 'Ziel', todayWorkout: 'Heutiges Training', noWorkout: 'Kein Training', protein: 'PROTEIN', carbs: 'KOHLENH.', fats: 'FETTE', carbohydrates: 'KOHLENHYDRATE', friendsLeaderboard: 'Rangliste', seeMore: 'Mehr →', aiNutritionAssistant: 'KI Ernährungsberater', aiActive: 'KI AKTIV', recentWorkouts: 'Letzte Trainings', viewAll: 'Alle', noWorkoutsYet: 'Noch keine Trainings!', you: 'DU',
        foodDiary: 'Ernährungstagebuch', breakfast: 'Frühstück', lunch: 'Mittag', dinner: 'Abendessen', snacks: 'Snacks', addFood: 'Hinzufügen', logFood: 'Eintragen', myMeals: 'Mahlzeiten', recipes: 'Rezepte', addToDiary: 'Hinzufügen', noFoodLogged: 'Nichts eingetragen', searchFood: 'Suchen oder KI fragen...', addingTo: 'Hinzufügen zu', meals: 'Mahlzeiten',
        sun: 'SO', mon: 'MO', tue: 'DI', wed: 'MI', thu: 'DO', fri: 'FR', sat: 'SA',
        january: 'Januar', february: 'Februar', march: 'März', april: 'April', may: 'Mai', june: 'Juni', july: 'Juli', august: 'August', september: 'September', october: 'Oktober', november: 'November', december: 'Dezember',
        startWorkout: 'Starten', createRoutine: 'Routine erstellen', exerciseSearch: 'Übungen suchen...', sets: 'Sätze', reps: 'Wdh', weight: 'Gewicht', rest: 'Pause', finishWorkout: 'Beenden', activeWorkout: 'Aktives Training', noWorkouts: 'Keine Trainings', myRoutines: 'MEINE ROUTINEN', workoutHistory: 'VERLAUF', noRoutines: 'Keine Routinen', tapToAdd: 'Tippe + zum Erstellen', workoutActivity: 'Trainingsaktivität', createFirstRoutine: 'Erstelle deine erste Routine mit dem Button unten', reorder: 'Sortieren', start: 'STARTEN',
        recipesForYou: 'REZEPTE FÜR DICH', aiNutrition: 'KI ERNÄHRUNGSCHAT', askAnything: 'Ernährungsfrage...', ingredients: 'Zutaten', steps_recipe: 'Schritte', saveToRecipes: 'Speichern', quickAdd: 'SCHNELL HINZUF.',
        filterAll: 'Alle', filterUnder10: 'Unter 10 Min', filterNoCook: 'Ohne Kochen', filterHighProtein: 'Proteinreich', filterPostWorkout: 'Nach Training',
        settings: 'Einstellungen', themeSettings: 'DESIGN', darkMode: 'Dunkelmodus', darkModeSub: 'Hell und dunkel wechseln', accentColor: 'AKZENTFARBE', aiIntegration: 'KI', openaiKey: 'OpenAI Schlüssel', geminiKey: 'Gemini Schlüssel', getApiKey: 'Schlüssel holen', timezone: 'ZEITZONE', affectsCalendar: 'Beeinflusst Daten', searchTimezone: 'Zeitzone suchen...', recalcTdee: 'TDEE berechnen', recalcTdeeSub: 'Kalorien aktualisieren', clearData: 'Daten löschen', clearDataSub: 'Alles löschen', logOut: 'Abmelden', logOutSub: 'Abmelden', language: 'SPRACHE', selectLanguage: 'Sprache',
        macroSplit: 'MAKROS', recalculate: '⟳ BERECHNEN', calorieGoal: 'Kalorienziel', stepGoal: 'Schritteziel', currentPlan: 'PLAN', level: 'Stufe', editProfile: 'Profil bearbeiten', dailyBonus: 'Tagesbonus', dailyGoals: 'TAGESZIELE', cut: 'Definieren', bulk: 'Aufbauen', maintain: 'Halten',
        today: 'Heute', kcal: 'kcal', secure: 'SICHER', min: 'Min', prepTime: 'Vorb.',
        snack: 'SNACK', postGym: 'NACH DEM GYM', loadingAi: 'Lade KI-Vorschlag...', deleteRoutine: 'Routine löschen', yesDelete: 'Ja, löschen', no: 'Nein', exercises: 'Übungen', general: 'Allgemein', profilePicture: 'Profilbild', chooseOption: 'Option wählen', logToDiary: 'Im Tagebuch eintragen',
        tapToLog: 'Tippe + zum Hinzufügen', areYouSureDelete: 'Möchtest du wirklich löschen', takePhoto: 'Foto aufnehmen', chooseFromLibrary: 'Aus Galerie wählen', removePhoto: 'Foto entfernen', reorder: 'Sortieren',
    },
    pt: {
        save: 'Salvar', cancel: 'Cancelar', done: 'Pronto', delete: 'Excluir', add: 'Adicionar', close: 'Fechar', search: 'Buscar', loading: 'Carregando...', reset: 'Redefinir', ok: 'OK',
        tab_dashboard: 'Início', tab_diary: 'Diário', tab_workouts: 'Treinos', tab_advice: 'Dicas', tab_profile: 'Perfil',
        dashboard: 'Início', diary: 'Diário', workouts: 'Treinos', advice: 'Dicas', profile: 'Perfil',
        goodMorning: 'Bom dia', goodAfternoon: 'Boa tarde', goodEvening: 'Boa noite',
        dailyCalories: 'Calorias', kcalRemaining: 'kcal restantes', steps: 'Passos', stepsGoal: 'meta', todayWorkout: 'Treino de hoje', noWorkout: 'Sem treino', protein: 'PROTEÍNA', carbs: 'CARBOIDR.', fats: 'GORDURAS', carbohydrates: 'CARBOIDRATOS', friendsLeaderboard: 'Ranking amigos', seeMore: 'Ver mais →', aiNutritionAssistant: 'Assistente nutrição IA', aiActive: 'IA ATIVA', recentWorkouts: 'Treinos recentes', viewAll: 'Ver tudo', noWorkoutsYet: 'Sem treinos ainda!', you: 'VOCÊ',
        foodDiary: 'Diário alimentar', breakfast: 'Café manhã', lunch: 'Almoço', dinner: 'Jantar', snacks: 'Lanches', addFood: 'Adicionar', logFood: 'Registrar', myMeals: 'Refeições', recipes: 'Receitas', addToDiary: 'Adicionar', noFoodLogged: 'Nada registrado', searchFood: 'Buscar ou IA...', addingTo: 'Adicionando a', meals: 'Refeições',
        sun: 'DOM', mon: 'SEG', tue: 'TER', wed: 'QUA', thu: 'QUI', fri: 'SEX', sat: 'SÁB',
        january: 'Janeiro', february: 'Fevereiro', march: 'Março', april: 'Abril', may: 'Maio', june: 'Junho', july: 'Julho', august: 'Agosto', september: 'Setembro', october: 'Outubro', november: 'Novembro', december: 'Dezembro',
        startWorkout: 'Iniciar', createRoutine: 'Criar rotina', exerciseSearch: 'Buscar exercícios...', sets: 'Séries', reps: 'Reps', weight: 'Peso', rest: 'Descanso', finishWorkout: 'Finalizar', activeWorkout: 'Treino ativo', noWorkouts: 'Sem treinos', myRoutines: 'MINHAS ROTINAS', workoutHistory: 'HISTÓRICO', noRoutines: 'Sem rotinas', tapToAdd: 'Toque + para criar', workoutActivity: 'Atividade treinos', createFirstRoutine: 'Crie sua primeira rotina com o botão abaixo', reorder: 'Reordenar', start: 'INICIAR',
        recipesForYou: 'RECEITAS PARA VOCÊ', aiNutrition: 'CHAT NUTRIÇÃO IA', askAnything: 'Pergunte sobre nutrição...', ingredients: 'Ingredientes', steps_recipe: 'Passos', saveToRecipes: 'Salvar', quickAdd: 'ADICIONAR RÁPIDO',
        filterAll: 'Todos', filterUnder10: 'Menos de 10 min', filterNoCook: 'Sem cozinhar', filterHighProtein: 'Alta proteína', filterPostWorkout: 'Pós-treino',
        settings: 'Configurações', themeSettings: 'TEMA', darkMode: 'Modo escuro', darkModeSub: 'Temas claro e escuro', accentColor: 'COR DESTAQUE', aiIntegration: 'IA', openaiKey: 'Chave API OpenAI', geminiKey: 'Chave API Gemini', getApiKey: 'Obter chave', timezone: 'FUSO HORÁRIO', affectsCalendar: 'Afeta datas', searchTimezone: 'Buscar fuso...', recalcTdee: 'Recalcular TDEE', recalcTdeeSub: 'Atualizar calorias', clearData: 'Limpar dados', clearDataSub: 'Excluir tudo', logOut: 'Sair', logOutSub: 'Sair da conta', language: 'IDIOMA', selectLanguage: 'Selecionar idioma',
        macroSplit: 'MACROS', recalculate: '⟳ RECALCULAR', calorieGoal: 'Meta calórica', stepGoal: 'Meta passos', currentPlan: 'PLANO', level: 'Nível', editProfile: 'Editar perfil', dailyBonus: 'Bônus diário', dailyGoals: 'METAS DIÁRIAS', cut: 'Definição', bulk: 'Volume', maintain: 'Manter',
        today: 'Hoje', kcal: 'kcal', secure: 'SEGURO', min: 'min', prepTime: 'Prep.',
        snack: 'LANCHE', postGym: 'PÓS-TREINO', loadingAi: 'Carregando sugestão IA...', deleteRoutine: 'Excluir rotina', yesDelete: 'Sim, excluir', no: 'Não', exercises: 'Exercícios', general: 'Geral', profilePicture: 'Foto de perfil', chooseOption: 'Escolha uma opção', logToDiary: 'Registrar no diário',
        tapToLog: 'Toque + para adicionar', areYouSureDelete: 'Tem certeza que deseja excluir', takePhoto: 'Tirar foto', chooseFromLibrary: 'Escolher da galeria', removePhoto: 'Remover foto', reorder: 'Reordenar',
    },
};

// Helper to get month names array from translations
export function getMonthNames(t) {
    return ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].map(k => t(k));
}

// Helper to get weekday name arrays from translations
export function getWeekdays(t) {
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(k => t(k));
}

// Fallback: any unlisted language falls back to English
const getFallback = (lang) => translations[lang] || translations.en;

// ─── Context ────────────────────────────────────────
const I18nContext = createContext({
    lang: 'en',
    changeLanguage: async () => { },
    t: (key) => translations.en[key] || key,
    ready: false,
});

export function I18nProvider({ children }) {
    const [lang, setLang] = useState('en');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            const s = await getSettings();
            if (s.language) setLang(s.language);
            setReady(true);
        })();
    }, []);

    const changeLanguage = async (code) => {
        setLang(code);
        const existing = await getSettings();
        await saveSettings({ ...existing, language: code });
    };

    const t = (key) => {
        const dict = getFallback(lang);
        return dict[key] || translations.en[key] || key;
    };

    return (
        <I18nContext.Provider value={{ lang, changeLanguage, t, ready }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    const ctx = useContext(I18nContext);
    // Safety: if provider hasn't mounted yet, return English fallback
    if (!ctx || typeof ctx.t !== 'function') {
        return {
            lang: 'en',
            changeLanguage: async () => { },
            t: (key) => translations.en[key] || key,
            ready: false,
        };
    }
    return ctx;
}
