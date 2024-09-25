/**************** TABLE: SCHEDULES ****************/
DROP TABLE IF EXISTS Schedules;
CREATE TABLE IF NOT EXISTS Schedules(
    LessonCode VARCHAR(25) NOT NULL,
    PresentationCode VARCHAR(25) NOT NULL,

    LessonName VARCHAR(255) NOT NULL,
    ProfessorName VARCHAR(100) NOT NULL,
    RoomName VARCHAR(100) NOT NULL,
    LessonDayOfWeek VARCHAR(15) NOT NULL DEFAULT "نامعین",
    LessonTimeStart VARCHAR(20) NOT NULL,
    LessonTimeEnd VARCHAR(20) NOT NULL,

    LessonEducationStage VARCHAR(50) NOT NULL,

    LessonDescriptions VARCHAR(512) DEFAULT "",

    PRIMARY KEY(LessonCode, PresentationCode),

    CONSTRAINT CHECK_DayOfWeeks CHECK(LessonDayOfWeek = "شنبه" OR LessonDayOfWeek = "یکشنبه" OR LessonDayOfWeek = "دوشنبه" OR LessonDayOfWeek = "سه‌شنبه" OR LessonDayOfWeek = "چهارشنبه" OR LessonDayOfWeek = "پنجشنبه" OR LessonDayOfWeek = "جمعه" OR LessonDayOfWeek = "نامعین")
);
/**************************************************/