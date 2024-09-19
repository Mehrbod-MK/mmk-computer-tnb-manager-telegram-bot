/**************** TABLE: ADMINS ****************/
DROP TABLE IF EXISTS Admins;
CREATE TABLE IF NOT EXISTS Admins
(
    ChatID BIGINT PRIMARY KEY NOT NULL,
    FullName NVARCHAR(100) NOT NULL,

    UserState INTEGER UNSIGNED NOT NULL DEFAULT 0,

    Can_SetChannel BOOLEAN NOT NULL
);

/* DEFAULT CREATOR -> Mehrbod Molla Kazemi */
INSERT INTO Admins VALUES
(146995203, "Mehrbod Molla Kazemi", 0, TRUE);
/*******************************************/

/**************** TABLE: USERS ****************/
DROP TABLE IF EXISTS Users;
CREATE TABLE IF NOT EXISTS Users(
    UserID BIGINT PRIMARY KEY NOT NULL,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) DEFAULT NULL,
    Username NVARCHAR(100) DEFAULT NULL,

    UserState INTEGER UNSIGNED NOT NULL DEFAULT 0,

    Email VARCHAR(255),

    Can_Use_CallbackQueries BOOLEAN NOT NULL DEFAULT TRUE
);
/**********************************************/

/**************** TABLE: CHANNELS ****************/
DROP TABLE IF EXISTS Channels;
CREATE TABLE IF NOT EXISTS Channels (
    ChannelID BIGINT PRIMARY KEY NOT NULL
);
/*************************************************/

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

    PRIMARY KEY(LessonCode, PresentationCode),

    CONSTRAINT CHECK_DayOfWeeks CHECK(LessonDayOfWeek = "شنبه" OR LessonDayOfWeek = "یکشنبه" OR LessonDayOfWeek = "دوشنبه" OR LessonDayOfWeek = "سه‌شنبه" OR LessonDayOfWeek = "چهارشنبه" OR LessonDayOfWeek = "پنجشنبه" OR LessonDayOfWeek = "جمعه" OR LessonDayOfWeek = "نامعین")
);
/**************************************************/

/**************** TABLE: CALLBACK QUERIES ****************/
DROP TABLE IF EXISTS CallbackQueries;
CREATE TABLE IF NOT EXISTS CallbackQueries(
    CallbackQueryID VARCHAR(50) PRIMARY KEY NOT NULL,
    From_UserID BIGINT NOT NULL,

    Schedule_LessonCode VARCHAR(25),
    Schedule_PresentationCode VARCHAR(25),

    Submission_Timestamp BIGINT NOT NULL,

    Submission_Result VARCHAR(100) NOT NULL,

    FOREIGN KEY(From_UserID) REFERENCES Users(UserID) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY(Schedule_LessonCode, Schedule_PresentationCode) REFERENCES Schedules(LessonCode, PresentationCode) ON UPDATE CASCADE ON DELETE CASCADE
);
/*********************************************************/
