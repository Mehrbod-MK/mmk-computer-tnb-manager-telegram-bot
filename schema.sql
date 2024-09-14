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
    ChatID BIGINT PRIMARY KEY NOT NULL,
    FirstName NVARCHAR(100) NOT NULL,

    UserState INTEGER UNSIGNED NOT NULL DEFAULT 0,

    Email VARCHAR(255)
);
/**********************************************/

/**************** TABLE: CHANNELS ****************/
DROP TABLE IF EXISTS Channels;
CREATE TABLE Channels (
    ChannelID BIGINT PRIMARY KEY NOT NULL
);
/*************************************************/
