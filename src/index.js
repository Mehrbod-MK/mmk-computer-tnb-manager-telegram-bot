/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Developer:  Mehrbod-MK
// Islamic Azad University - Tehran North Branch
// Date:  19 Shahrivar 1403

import "persian-date"
import persianDate from "persian-date"

// Define array of registered users.
let users = []

// STATE DEFINITIONS.
const STATE_USER_INITIAL = 0
const STATE_CREATOR_SETTING_CHANNEL = 1

// STRING DEFINITIONS
const MESSAGE_RESTRICTED_ACCESS = "⛔ شما مجاز به دسترسی به این قسمت نمی‌باشید."

export default
{
  async scheduled(event, env, ctx) {
    await CronReached(event, env, ctx)
  },

  fetch(request, env)
  {
    var response = handleRequest(request, env);
    return response;
  }
}

async function CronReached(event, env, ctx)
{
  // Get the list of lessons that belong to today.
  let schedulesForToday = await DB_Get_ListOfSchedules_Today(env)

  // Shamsi DateTime now.
  let shamsiDateTimeNow = System_Get_Shamsi_JSON(new Date())

  // Enumerate each lesson for today.
  for(let i = 0; i < schedulesForToday.length; i++)
  {
    // Get schedule object.
    let scheduleJSON = schedulesForToday[i]

    // Extract time literals from DB time string.
    let schedule_Start_TimeLiterals = scheduleJSON.LessonTimeStart.match(/(-\d+|\d+)(,\d+)*(\.\d+)*/g)
    let schedule_End_TimeLiterals = scheduleJSON.LessonTimeEnd.match(/(-\d+|\d+)(,\d+)*(\.\d+)*/g)

    // Calculate required times in minutes from 00:00.
    let minutesPassedToday = (shamsiDateTimeNow.shamsi_Date.hour() * 60) + shamsiDateTimeNow.shamsi_Date.minute()
    let minutesForStart = (+schedule_Start_TimeLiterals[0] * 60) + +schedule_Start_TimeLiterals[1]
    let minutesForEnd = (+schedule_End_TimeLiterals[0] * 60) + +schedule_End_TimeLiterals[1]

    // Assign time thresholds.
    const threshold_Minutes_BeforeStartingSchedule = 5

    // Is lesson going to start in a few minutes?
    let minutes_Left_ToStart = minutesForStart - minutesPassedToday
    if(minutes_Left_ToStart === threshold_Minutes_BeforeStartingSchedule)
    {
      // DR ALIMOHAMMADZADE: No need for reminder.
      // await Prompt_Channel_ScheduleIsAboutToStart(env, scheduleJSON)
    }

    // If lesson's time has reached.
    // if(minutes_Left_ToStart === 0)
    // DR ALIMOHAMMADZADE:  Announce 1 hour beforehand.
    if(minutes_Left_ToStart == 60)
    {
      await Prompt_Channel_ScheduleStartedNow(env, scheduleJSON)
    }
  }
}

// Function for sending a message to a chat id.
async function Bot_SendTextMessage(env, chat_id, text, reply_markup, parse_mode = "HTML")
{
  let messageJSON = 
  {
    chat_id,
    text,
    reply_markup,
    parse_mode
  }

  const url = `https://api.telegram.org/bot${env.API_KEY}/sendMessage`
  
  const data = await fetch(url,
    {
      method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageJSON)
    }).then(resp => resp.json())
}

async function Bot_AnswerCallbackQuery(env, callback_query_id, text = "🔵 پردازش شد.", show_alert = true)
{
  let answerCallbackQueryJSON = 
  {
    callback_query_id,
    text,
    show_alert
  }

  const url = `https://api.telegram.org/bot${env.API_KEY}/answerCallbackQuery`
  
  const data = await fetch(url,
    {
      method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(answerCallbackQueryJSON)
    }).then(resp => resp.json())
}

async function Bot_EditMessageReplyMarkup(env, chat_id, message_id, reply_markup)
{
  let editMessageReplyMarkupJSON = 
  {
    chat_id,
    message_id,
    reply_markup
  }

  const url = `https://api.telegram.org/bot${env.API_KEY}/editMessageReplyMarkup`
  
  const data = await fetch(url,
    {
      method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(editMessageReplyMarkupJSON)
    }).then(resp => resp.json())
}

// Function for checking admin privileges.
async function IsAdmin(env, userId)
{
  const stmt = env.DB.prepare("SELECT * FROM Admins")
  const { results } = await stmt.all()
  for(let a = 0; a < results.length; a++)
  {
    if(results[a].ChatID === userId)
    {
      return true;
    }
  }

  return false;
}

async function DB_Get_Admin_State(env, adminChatId)
{
  const stmt = env.DB.prepare("SELECT * FROM Admins WHERE ChatID = ?").bind(adminChatId)
  const { results } = await stmt.all()
  if(results.length != 1)
  {
    return -1
  }

  return results[0].UserState
}

async function DB_Set_Admin_State(env, adminChatId, newState)
{
  const stmt = env.DB.prepare("UPDATE Admins SET UserState = ? WHERE ChatID = ?").bind(newState, adminChatId)
  await stmt.run()
}

async function DB_Delete_AnnouncementChannel(env)
{
  const stmt = env.DB.prepare("DELETE FROM Channels")
  await stmt.run()
}

async function DB_Set_AnnouncementChannel(env, newChannelId)
{
  await DB_Delete_AnnouncementChannel(env)

  const stmt = env.DB.prepare("INSERT INTO Channels VALUES(?)").bind(newChannelId)
  await stmt.run()
}

async function DB_Get_AnnouncementChannel(env)
{
  const stmt = env.DB.prepare("SELECT * FROM Channels LIMIT 1")
  const { results } = await stmt.all()

  if(results.length != 1)
  {
    return NaN
  }

  return results[0].ChannelID
}

async function DB_Get_ListOfSchedules_Today(env)
{
  const stmt = env.DB.prepare("SELECT * FROM Schedules WHERE LessonDayOfWeek = ?").bind(`${System_Get_Shamsi_JSON(new Date()).shamsi_NameOfDayOfWeek}`)
  const { results } = await stmt.all()

  return results
}

async function handleRequest(request, env)
{
  // If there is a POST request...
  if(request.method === "POST")
  {
    // Get JSON.
    const payload = await request.json()

    // Update -> Message
    if("message" in payload)
    {
      let message = payload.message

      // Message -> Text (Chat)
      if(("text" in message) && ("chat" in message) && ("from" in message))
      {
        if(await Process_Message_Text_Chat(env, message) === true)
        {
          return new Response("OK")
        }
      }

      // Prompt message -> bad input command if all message routings fail.
      await Prompt_Message_BadInputCommand(env, payload.message)
    }

    // Update -> CallbackQuery
    if("callback_query" in payload)
    {
      let cbQuery = payload.callback_query

      if(await Process_CallbackQuery(env, cbQuery) === true)
      {
        return new Response("OK")
      }

      // Answer CallbackQuery -> Internal Error.
      await Bot_AnswerCallbackQuery(env, cbQuery.id, "🚫 خطای داخلی سیستم به وقوع پیوست.\n⁉ برای این کلید، دستوری تعریف نشده است یا پارامتر اشتباه وجود دارد.\n\n👈 لطفاً با راهبر سیستم تماس بگیرید.")
      return new Response("OK")
    }

    // Update -> Channel Post
    if("channel_post" in payload)
    {
      let channel_Message = payload.channel_post
      
      // Route -> Macro Command.
      if(await Route_MacroCommand(env, channel_Message) === true)
      {
        return new Response("OK")
      }
    }

  }

  return new Response("OK")
}

async function DB_Get_User(env, userID)
{
  const stmt = env.DB.prepare("SELECT * FROM Users WHERE UserID = ?").bind(userID)
  const { results } = await stmt.all()

  if(results.length === 0)
  {
    return null
  }

  return results[0]
}

async function DB_Add_User(env, telegramUserJSON)
{
  console.log(telegramUserJSON)
  let stmt = null;
  if("last_name" in telegramUserJSON && "username" in telegramUserJSON)
  {
    stmt = env.DB.prepare("INSERT INTO Users(UserID, FirstName, LastName, Username) VALUES(?, ?, ?, ?)").bind(telegramUserJSON.id, telegramUserJSON.first_name, telegramUserJSON.last_name, telegramUserJSON.username)
  }
  else if("username" in telegramUserJSON)
  {
    stmt = env.DB.prepare("INSERT INTO Users(UserID, FirstName, Username) VALUES(?, ?, ?)").bind(telegramUserJSON.id, telegramUserJSON.first_name, telegramUserJSON.username)
  }
  else if("last_name" in telegramUserJSON)
  {
    stmt = env.DB.prepare("INSERT INTO Users(UserID, FirstName, LastName) VALUES(?, ?, ?)").bind(telegramUserJSON.id, telegramUserJSON.first_name, telegramUserJSON.last_name)
  }
  if(stmt !== null)
  {
    const { success } = await stmt.all()
    return success
  }
  return false;
}

async function DB_AddOrGet_User(env, telegramUserJSON)
{
  // Check for existing user.
  let existingUser = await DB_Get_User(env, telegramUserJSON.id)
  if(existingUser !== null)
  {
    return existingUser
  }

  // Otherwise, add the user to the database.
  let addNewUserResult = await DB_Add_User(env, telegramUserJSON)
  // If the reuslt was successful, get the new user and return it.
  if(addNewUserResult === true)
  {
    return await DB_Get_User(env, telegramUserJSON.id)
  }

  // Return NULL otherwise.
  return null
}

async function DB_Get_Schedule(env, lessonCode, presentationCode)
{
  const stmt = env.DB.prepare("SELECT * FROM Schedules WHERE LessonCode = ? AND PresentationCode = ?").bind(lessonCode, presentationCode)
  const { results } = await stmt.all()

  if(results.length === 0)
  {
    return null
  }

  return results[0]
}

async function DB_Check_Schedule_IsWithinDateTime(env, schedule, dateTime)
{
  // Get Shamsi DateTime.
  let shamsiJSON = System_Get_Shamsi_JSON(dateTime)

  // Check the day of schedule. If it is not today, return false.
  if(shamsiJSON.shamsi_NameOfDayOfWeek !== schedule.LessonDayOfWeek)
  {
    return false
  }

  // Extract time literals from DB time string.
  let schedule_Start_TimeLiterals = schedule.LessonTimeStart.match(/(-\d+|\d+)(,\d+)*(\.\d+)*/g)
  let schedule_End_TimeLiterals = schedule.LessonTimeEnd.match(/(-\d+|\d+)(,\d+)*(\.\d+)*/g)
  // Calculate required times in minutes from 00:00.
  let minutesPassedForDate = (shamsiJSON.shamsi_Date.hour() * 60) + shamsiJSON.shamsi_Date.minute()
  let minutesForStart = (+schedule_Start_TimeLiterals[0] * 60) + +schedule_Start_TimeLiterals[1]
  let minutesForEnd = (+schedule_End_TimeLiterals[0] * 60) + +schedule_End_TimeLiterals[1]

  // Check if time is witihin schedule time. If not, return false.
  if((minutesPassedForDate < minutesForStart) || (minutesPassedForDate > minutesForEnd))
  {
    return false
  }

  // Result is OK.
  return true
}

async function DB_Get_Schedule_Votes_Count(env, scheduleJSON, dateOfSubmissionOBJ, submissionReason, submissionResult)
{
  const stmt_Count_Votes = env.DB.prepare("SELECT COUNT(*) FROM CallbackQueries WHERE Schedule_LessonCode = ? AND Schedule_PresentationCode = ? AND Submission_Date = ? AND Submission_Reason = ? AND Submission_Result = ?").bind(scheduleJSON.LessonCode, scheduleJSON.PresentationCode, System_Get_Shamsi_Date_String(dateOfSubmissionOBJ), submissionReason, submissionResult)
  const db_Count_Votes = +((await stmt_Count_Votes.raw())[0][0])

  return db_Count_Votes
}

async function Bot_DB_UpdateVoteCounts_TeacherPresences(env, telegram_CallbackQuery, cbQueryDB)
{
  const stmt_Count_OKs = env.DB.prepare("SELECT COUNT(*) FROM CallbackQueries WHERE Schedule_LessonCode = ? AND Schedule_PresentationCode = ? AND Submission_Date = ? AND Submission_Reason = ? AND Submission_Result = ?").bind(cbQueryDB.Schedule_LessonCode, cbQueryDB.Schedule_PresentationCode, cbQueryDB.Submission_Date, "Teacher Presence", "OK")
  const db_Count_OKs = +((await stmt_Count_OKs.raw())[0][0])
  const stmt_Count_NOKs = env.DB.prepare("SELECT COUNT(*) FROM CallbackQueries WHERE Schedule_LessonCode = ? AND Schedule_PresentationCode = ? AND Submission_Date = ? AND Submission_Reason = ? AND Submission_Result = ?").bind(cbQueryDB.Schedule_LessonCode, cbQueryDB.Schedule_PresentationCode, cbQueryDB.Submission_Date, "Teacher Presence", "NOK")
  const db_Count_NOKs = +((await stmt_Count_NOKs.raw())[0][0])
  const stmt_Count_DELAYs = env.DB.prepare("SELECT COUNT(*) FROM CallbackQueries WHERE Schedule_LessonCode = ? AND Schedule_PresentationCode = ? AND Submission_Date = ? AND Submission_Reason = ? AND Submission_Result = ?").bind(cbQueryDB.Schedule_LessonCode, cbQueryDB.Schedule_PresentationCode, cbQueryDB.Submission_Date, "Teacher Presence", "DELAY")
  const db_Count_DELAYs = +((await stmt_Count_DELAYs.raw())[0][0])

  let inlineKeyboard_NewVoteCounts = {
    inline_keyboard: [
      [ 
        { text: `👍 (${db_Count_OKs})`, callback_data: `SCH_OK_${cbQueryDB.Schedule_LessonCode}_${cbQueryDB.Schedule_PresentationCode}` }, 
        { text: `👎`, callback_data: `SCH_NOK_${cbQueryDB.Schedule_LessonCode}_${cbQueryDB.Schedule_PresentationCode}` },
        { text: `⏳`, callback_data: `SCH_DELAY_${cbQueryDB.Schedule_LessonCode}_${cbQueryDB.Schedule_PresentationCode}` }
      ],
      [
        { text: "💬 ثبت نظر", callback_data: `SCH_COMNT_${cbQueryDB.Schedule_LessonCode}_${cbQueryDB.Schedule_PresentationCode}` }
      ],
      [
        { text: "🗝 پنل کنترل درس", callback_data: `SCH_ADMIN_${cbQueryDB.Schedule_LessonCode}_${cbQueryDB.Schedule_PresentationCode}` }
      ]
    ]
  }

  await Bot_EditMessageReplyMarkup(env, telegram_CallbackQuery.message.chat.id, telegram_CallbackQuery.message.message_id, inlineKeyboard_NewVoteCounts)
}

async function DB_Get_CallbackQuery_Schedule(env, userID, scheduleLessonCode, schedulePresentationCode, submissionDate_String, submission_Reason)
{
  const stmt = env.DB.prepare("SELECT * FROM CallbackQueries WHERE From_UserID = ? AND Schedule_LessonCode = ? AND Schedule_PresentationCode = ? AND Submission_Date = ? AND Submission_Reason = ?").bind(userID, scheduleLessonCode, schedulePresentationCode, submissionDate_String, submission_Reason)
  const { results } = await stmt.all()

  if(results.length == 0)
  {
    return null
  }

  return results[0]
}

async function Process_CallbackQuery_Display(env, user, callback_query)
{
  // Check expected tokens length.
  let tokens = callback_query.data.split('_')
  if((tokens.length !== 4) || (tokens[0] !== "DISP"))
  {
    return false
  }

  // Get schedule.
  let schedule = await DB_Get_Schedule(env, tokens[2], tokens[3])
  if(schedule === null)
  {
    return false
  }

  // Admin -> View Votes.
  if(tokens[1] === "VOTES")
  {
    // If not an admin, don't display vote counts.
    if(await IsAdmin(env, callback_query.from.id) === false)
    {
      await Bot_AnswerCallbackQuery(env, callback_query.id, MESSAGE_RESTRICTED_ACCESS)
      return true
    }

    // Get votes count.
    let dateTimeNow = new Date()
    let votes_OK = await DB_Get_Schedule_Votes_Count(env, schedule, dateTimeNow, "Teacher Presence", "OK")
    let votes_NOK = await DB_Get_Schedule_Votes_Count(env, schedule, dateTimeNow, "Teacher Presence", "NOK")
    let votes_DELAY = await DB_Get_Schedule_Votes_Count(env, schedule, dateTimeNow, "Teacher Presence", "DELAY")

    let toastText_VotesResults = `📊 گزارش حضور استاد در کلاس درس:
  
  👍 حضور استاد:  ${votes_OK}
  👎 عدم حضور استاد:  ${votes_NOK}
  ⏳ تأخیر استاد:  ${votes_DELAY}
  
  ➕ تعداد کل آراء:  ${votes_OK + votes_NOK + votes_DELAY}`

    await Bot_AnswerCallbackQuery(env, callback_query.id, toastText_VotesResults)

    return true
  }

  // Admin -> Exit Panel.
  else if(tokens[1] === "SCH")
  {
    return await Prompt_InlineButtons_Schedule_Display(env, callback_query, schedule)
  }

  return false
}

async function Process_CallbackQuery_Schedule(env, user, callback_query)
{
  // Check expected tokens length.
  let tokens = callback_query.data.split('_')
  if((tokens.length !== 4) || (tokens[0] !== "SCH"))
  {
    return false
  }

  // Get schedule.
  let schedule = await DB_Get_Schedule(env, tokens[2], tokens[3])
  if(schedule === null)
  {
    return false
  }

  // SCH -> Admin Panel
  if(tokens[1] == "ADMIN")
  {
    // Check if user is not an admin.
    if(await IsAdmin(env, callback_query.from.id) === false)
    {
      await Bot_AnswerCallbackQuery(env, callback_query.id, MESSAGE_RESTRICTED_ACCESS)
      return true
    }

    // Display new admin control buttons for schedule.
    return Prompt_InlineButtons_Schedule_AdminPanel(env, callback_query, schedule)
  }

  // Check if schedule has arrived and the user can submit their response.
  if(await DB_Check_Schedule_IsWithinDateTime(env, schedule, new Date()) === false)
  {
    await Bot_AnswerCallbackQuery(env, callback_query.id, "❌ فقط در بازه زمانی برگزاری کلاس می‌توانید رأی خود را ثبت کنید.")
    return true
  }

  // Check if the user had previously submitted schedule result. If submitted, deny user.
  let previousSubmittedCBQuery = await DB_Get_CallbackQuery_Schedule(env, user.UserID, schedule.LessonCode, schedule.PresentationCode, System_Get_Shamsi_Date_String(new Date()), "Teacher Presence")
  if(previousSubmittedCBQuery != null)
  {
    await Bot_AnswerCallbackQuery(env, callback_query.id, "❌ فقط یک بار می‌توانید رأی خود را ثبت کنید.")

    // Update vote counts.
    await Bot_DB_UpdateVoteCounts_TeacherPresences(env, callback_query, previousSubmittedCBQuery)
    
    return true
  }

  // Write new submitted callback query.
  const stmt = env.DB.prepare("INSERT INTO CallbackQueries VALUES(?, ?, ?, ?, ?, ?, ?)").bind(callback_query.id, user.UserID, schedule.LessonCode, schedule.PresentationCode, System_Get_Shamsi_Date_String(new Date()), "Teacher Presence", tokens[1])
  const { success } = await stmt.all()

  // Answer the callback query finally.
  if(success === true)
  {
    await Bot_AnswerCallbackQuery(env, callback_query.id, "✅ رأی شما با موفقیت ثبت شد.")

    // Update vote counts.
    let newWrittenCB = await DB_Get_CallbackQuery_Schedule(env, user.UserID, schedule.LessonCode, schedule.PresentationCode, System_Get_Shamsi_Date_String(new Date()), "Teacher Presence")
    await Bot_DB_UpdateVoteCounts_TeacherPresences(env, callback_query, newWrittenCB)
  }
  else
  {
    await Bot_AnswerCallbackQuery(env, callback_query.id, "🚫 خطا در ارتباط با پایگاه داده جهت ثبت رأی.\n\n👈 لطفاً با راهبر بات تماس بگیرید.")
  }

  return true
}

async function Process_CallbackQuery(env, callback_query)
{
  let cbQuery_Id = callback_query.id
  let cbQuery_Tokens = callback_query.data.split('_')

  // Get the user who has requested this callback query.
  let cbQuery_User = await DB_AddOrGet_User(env, callback_query.from)

  // If query does not contain any data, cancel this routing.
  if(cbQuery_Tokens.length == 0)
  {
    return false
  }

  // If the user is not allowed to work with callback queries.
  if(cbQuery_User.Can_Use_CallbackQueries === false)
  {
    await Bot_AnswerCallbackQuery(env, cbQuery_Id, "⛔ شما مجاز به تعامل با بات نمی‌باشید.\n\n👈 لطفاً با راهبر بات تماس بگیرید.")
    return true
  }

  // SCH -> Schedules.
  if(cbQuery_Tokens[0] === "SCH")
  {
    // Write schedule data to DB.
    return await Process_CallbackQuery_Schedule(env, cbQuery_User, callback_query)
  }

  // DISP -> Displayables.
  else if(cbQuery_Tokens[0] === "DISP")
  {
    // Process display message.
    return await Process_CallbackQuery_Display(env, cbQuery_User, callback_query)
  }

  return false
}

async function Process_Message_Text_Chat(env, message)
{
  // Route -> Macro Command.
  if(await Route_MacroCommand(env, message) === true)
  {
    return true
  }

  let chatType = message.chat.type

  if(chatType === "private")
  {
    let chatId = message.from.id

    // Route -> Creator.
    if(await Route_PrivateChat_IsCreator(env, message) === true)
    {
      return true
    }

    // Route -> Private Chat -> New User
    if(await Route_PrivateChat_NonRegisteredUser(env, message) === true)
    {
      return true
    }
  }
}

// Handler -> Macro command.
async function Route_MacroCommand(env, message)
{
  if("text" in message)
  {
    let messageText = message.text

    let loweredText = messageText.toLowerCase()
    
    // /mmk_comptnb_getChatId
    if(loweredText === "/mmk_comptnb_getchatid")
    {
      let prompt_ChatIdText = `☁ شماره انحصاری این چت:\n<code>${message.chat.id}</code>`
    
      await Bot_SendTextMessage(env, message.chat.id, prompt_ChatIdText, {})

      return true
    }

    // /mmk_comptnb_getUserId
    if(loweredText === "/mmk_comptnb_getuserid")
    {
      if("from" in message)
      {
        let prompt_UserIdText = `🔑 شماره انحصاری نشست کاربری:\n<code>${message.from.id}</code>`
        await Bot_SendTextMessage(env, message.chat.id, prompt_UserIdText, {})
      }
      else
      {
        await Bot_SendTextMessage(env, message.chat.id, "🚫 شماره نشست کاربری فقط از طریق ارسال پیام خصوصی به بات امکان‌پذیر می‌باشد.", {})
      }

      return true
    }

    // test_channel.
    if(loweredText === "/test_channel")
    {
      let prompt_TestChannelResult = ""

      if("from" in message)
      {
        let channelID = await DB_Get_AnnouncementChannel(env)

        // If input channel is not a number...
        if(isNaN(channelID) === true)
        {
          await Bot_SendTextMessage(env, message.chat.id, "❌ مقدار شماره کانال تنظیم شده معتبر نیست.\n\n👈 از /start استفاده کنید.")
          return true
        }

        // Send a test message to specified channel.
        let promptText_TestMessage = `✅ پیام تست ارسال شده.\n\n👈 از طرف:  <b>${message.from.first_name}</b>\n📅 تاریخ: <b>${System_GetDateTime_NumericPersianString(new Date())}</b>`
        await Bot_SendTextMessage(env, channelID, promptText_TestMessage, {})
        await Bot_SendTextMessage(env, message.chat.id, `✅ پیام تست با موفقیت ارسال شد.\n\n⚠ <i>در صورت عدم مشاهده پیام، یعنی بات را به کانال اضافه نکرده‌اید یا دسترسی ارسال پیام بات در کانال را بسته‌اید.</i>`, {})

        return true
      }
    }

    // /start
    if(loweredText === "/start")
    {
      if("from" in message)
      {
        if(await IsAdmin(env, message.from.id) === true)
        {
          let admin_State = await DB_Get_Admin_State(env, message.from.id)

          switch(admin_State)
          {
            case STATE_USER_INITIAL:
              await Prompt_Creator_MainMenu(env, message)
              return true

            case STATE_CREATOR_SETTING_CHANNEL:
              await Prompt_Creator_SetChannel(env, message)
              return true
          }
        }
      }
    }
  }

  return false
}

// Handler -> Private Chat - Is Creator
async function Route_PrivateChat_IsCreator(env, message)
{
  if(await IsAdmin(env, message.from.id) === true)
  {
    let admin_State = await DB_Get_Admin_State(env, message.from.id)

    switch(admin_State)
    {
      // Initial state.
      case STATE_USER_INITIAL:

        // Creator -> Set Channel
        if(message.text === "📢 تنظیم کانال اطلاع‌رسانی")
        {
          await Prompt_Creator_SetChannel(env, message)
          // creator_State = STATE_CREATOR_SETTING_CHANNEL
          await DB_Set_Admin_State(env, message.from.id, STATE_CREATOR_SETTING_CHANNEL)

          return true
        }

        // Creator -> View Bot Status
        if(message.text === "🤖 درباره بات")
        {

          return true
        }
        
        break

      // Creator -> Setting Announcement Channel.
      case STATE_CREATOR_SETTING_CHANNEL:

        // Remove Current Channel.
        if(message.text === "❌ حذف کانال تنظیم شده فعلی در صورت وجود")
        {
          // Delete channel, then re-prompt.
          await DB_Delete_AnnouncementChannel(env)
          await Prompt_RemovedAnnouncementChannelID(env, message)
          await Prompt_Creator_SetChannel(env, message)

          return true
        }

        // Go back to previous menu.
        if(message.text === "🔙 بازگشت به منوی قبلی")
        {
          await DB_Set_Admin_State(env, message.from.id, STATE_USER_INITIAL)
          await Prompt_Creator_MainMenu(env, message)

          return true
        }

        // Otherwise, treat input text as Channel ID.
        await DB_Set_AnnouncementChannel(env, +message.text)
        await Prompt_SetAnnouncementChannel(env, message, +message.text)

        // Automatically return to main menu.
        await DB_Set_Admin_State(env, message.from.id, STATE_USER_INITIAL)
        await Prompt_Creator_MainMenu(env, message)

        return true

        break
    }
  }

  return false
}

async function Route_PrivateChat_NonRegisteredUser(env, message)
{
  // Check if user is not the creator himself.
  if(await IsAdmin(env, message.from.id) === true)
  {
    return false
  }

  // Check if this is not a registered user.
  if(users.indexOf(message.from.id) == -1)
  {
    // Add new user to the list of users interacted with the bot.
    users.push(
      {
        telegram_User:  message.from,

        user_State: 0
      }
    )

    let text_WelcomeMenu = "🌟 به نام خدا" + "\r\n" + "\r\n" + "👋 سلام و درود" + "\n" + "<b>به سامانه تلگرامی مدیریت امور آموزشی گروه کامپیوتر و فناوری اطلاعات دانشگاه آزاد اسلامی واحد تهران شمال خوش آمدید</b>" + "\r\n" + "\r\n" + "<i>👇 با استفاده از گزینه‌های ذیل، می‌توانید از خدمات سامانه بهره‌مند شوید.</i>"
    let replyMarkup_WelcomeMenuKeyboard = 
    {
      keyboard: [
        [{ text: '🤖 درباره بات' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
      input_field_placeholder: "انتخاب کنید...",
      is_persistent: true
    }

    await Bot_SendTextMessage(env, message.chat.id, text_WelcomeMenu, replyMarkup_WelcomeMenuKeyboard)

    return true
  }

  return false
}

async function Prompt_Message_BadInputCommand(env, message)
{
  if(message === undefined)
  {
    return
  }

  let text_BadInput = `🚫 دستور وارد شده در این لحظه قابل پردازش نیست.
  
  👈 می‌توانید از /start استفاده کنید.`

  if("chat" in message)
  {
    await Bot_SendTextMessage(env, message.chat.id, text_BadInput, {})
  }
}

async function Prompt_Creator_SetChannel(env, message)
{
  let channelID = await DB_Get_AnnouncementChannel(env)

  let promptText_SetChannel = `<b>👈 تنظیم کانال اطلاع‌رسانی بات</b>

  ${(channelID === null || isNaN(channelID) === true) ? `🔵 کانالی تنظیم نشده است.` : `🟢 شماره چت کانال:  <code>${channelID}</code>`}
  
  👇 حال، می‌توانید با وارد کردن شماره چت کانال جدید، آن را جهت اطلاع رسانی بات تنظیم کنید.`

  await Bot_SendTextMessage(env, message.chat.id, promptText_SetChannel, { keyboard: [[{ text: "❌ حذف کانال تنظیم شده فعلی در صورت وجود" }], [{text: "🔙 بازگشت به منوی قبلی"}]]})
}

async function Prompt_SetAnnouncementChannel(env, message, newChannelID)
{
  let prompt_SetChannelID = `✅ کانال اطلاع‌رسانی با موفقیت به شماره 
  <code>${newChannelID}</code>
  تنظیم شد.
  
  👈 می‌توانید با استفاده از دستور /test_channel، یک پیام آزمایشی به کانال تنظیم شده توسط بات ارسال کنید.
  
  <i><b>⚠ در صورت بروز هر گونه اشکال، می‌توانید از دستور /help استفاده کنید.</b></i>`

  await Bot_SendTextMessage(env, message.chat.id, prompt_SetChannelID, { remove_keyboard: true })
}

async function Prompt_Creator_MainMenu(env, message)
{
  let text_CreatorMenu = "👈 مهربد ملاکاظمی خوبده گرامی، به سامانه خوش آمدید."
  let replyMarkup_CreatorMenu = 
  {
    keyboard: [
                [{ text: '📢 تنظیم کانال اطلاع‌رسانی' }],
                  [{ text: '🤖 درباره بات' }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
                input_field_placeholder: "پنل سازنده",
                is_persistent: true
              }
          
    await Bot_SendTextMessage(env, message.chat.id, text_CreatorMenu, replyMarkup_CreatorMenu)
}

async function Prompt_RemovedAnnouncementChannelID(env, message)
{
  let promptText_RemovedChannel = `☑ کانال با موفقیت حذف شد.`

  await Bot_SendTextMessage(env, message.chat.id, promptText_RemovedChannel, {})
}

function System_GetDateTime_NumericPersianString(date)
{
  let options = {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }

  return date.toLocaleString('fa-IR', options)
}

function System_Get_Shamsi_JSON(gregorianDate)
{
  let options = {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }
  let gregorianDateString = gregorianDate.toLocaleString([], options)

  let gregorianDateNumberLiterals = gregorianDateString.match(/(-\d+|\d+)(,\d+)*(\.\d+)*/g)

  let correctGregorianDate = new Date(+gregorianDateNumberLiterals[2], +gregorianDateNumberLiterals[0] - 1, gregorianDateNumberLiterals[1], gregorianDateNumberLiterals[3], gregorianDateNumberLiterals[4], gregorianDateNumberLiterals[5], 0)

  let shamsiDate = new persianDate(correctGregorianDate)
  let dayOfWeekIndex = shamsiDate.day()
  let nameOfMonth = shamsiDate.toLocale('fa').format("MMMM")

  let nameOfDayOfWeek = "نامعین"
  switch(dayOfWeekIndex)
  {
    case 1:
      nameOfDayOfWeek = "شنبه"
      break
    case 2:
      nameOfDayOfWeek = "یکشنبه"
      break
    case 3:
      nameOfDayOfWeek = "دوشنبه"
      break
    case 4:
      nameOfDayOfWeek = "سه‌شنبه"
      break
    case 5:
      nameOfDayOfWeek = "چهارشنبه"
      break
    case 6:
      nameOfDayOfWeek = "پنجشنبه"
      break
    case 7:
      nameOfDayOfWeek = "جمعه"
      break
  }

  let jsonObject = { shamsi_Date: shamsiDate, shamsi_NameOfDayOfWeek: nameOfDayOfWeek, shamsi_NameOfMonth: nameOfMonth }

  return jsonObject
}

async function Prompt_Channel_ScheduleIsAboutToStart(env, scheduleJSON)
{
  let promptText_ScheduleIsAboutToStart = `🔔 #یادآوری

🏛 کلاس درس <b>${scheduleJSON.LessonName}</b> با کد درس <b>${scheduleJSON.LessonCode}</b> و کد ارائه <b>${scheduleJSON.PresentationCode}</b> در مقطع <b>${scheduleJSON.LessonEducationStage}</b> توسط استاد محترم <b>${scheduleJSON.ProfessorName}</b> در کلاس <b>${scheduleJSON.RoomName}</b> امروز <u>${scheduleJSON.LessonDayOfWeek}</u> رأس ساعت <b>${scheduleJSON.LessonTimeStart}</b> طبق تقویم دانشگاهی برگزار خواهد شد و تا <b>${scheduleJSON.LessonTimeEnd}</b> ادامه خواهد داشت.

🙏 از دانشجویان محترم تقاضا می‌شود تا رأس ساعت مقرر سر کلاس حاضر شوند.
⚠ <b><i>در صورت هماهنگی عدم تشکیل کلاس توسط استاد، مراتب را به آموزش گروه کامپیوتر اطلاع دهید.</i></b>`

  await Bot_SendTextMessage(env, await DB_Get_AnnouncementChannel(env), promptText_ScheduleIsAboutToStart, {})
}

async function Prompt_Channel_ScheduleStartedNow(env, scheduleJSON)
{
  /*let promptText_ScheduleStarted = `⭐ #اعلان

🏛 کلاس درس <b>${scheduleJSON.LessonName}</b> با کد درس <b>${scheduleJSON.LessonCode}</b> و کد ارائه <b>${scheduleJSON.PresentationCode}</b> در مقطع <b>${scheduleJSON.LessonEducationStage}</b> توسط استاد محترم <b>${scheduleJSON.ProfessorName}</b> در کلاس <b>${scheduleJSON.RoomName}</b> امروز <u>${scheduleJSON.LessonDayOfWeek}</u> رأس ساعت <b>${scheduleJSON.LessonTimeStart}</b> شروع شده است.

⌛ دانشجویان باید بر اساس تعداد واحدهای درسی، مدت زمانی را منتظر استاد باشند.

👍 در صورت حضور استاد در کلاس، بر روی لایک کلیک کنید.
👎 در صورت عدم حضور استاد در کلاس پس از موعد مقرر یا هماهنگی قبلی، بر روی دیسلایک کلیک کنید.
⏳ در صورت حضور استاد پس از میزان تأخیر قابل توجه، بر روی ساعت شنی کلیک کنید.

⚠ <b>توجه:  مسئولیت گزارش دروغ بر عهده دانشجو خواهد بود و شخص خاطی، به کمیته انضباطی معرفی خواهد شد.</b>`*/

// DR ALIMOHAMMADZADE:  New message. + CHANGE MARKUPS.

let promptText_ScheduleStarted = `⭐ #اعلان

📚 #${scheduleJSON.LessonName.replaceAll(' ', '_')}

🌟 استاد #${scheduleJSON.ProfessorName.replaceAll(' ', '_')}

🏛 اتاق #${scheduleJSON.RoomName.replaceAll(' ', '_')}
📅 روز #${scheduleJSON.LessonDayOfWeek.replaceAll(' ', '_')}
⌚ ساعت ${scheduleJSON.LessonTimeStart} تا ${scheduleJSON.LessonTimeEnd}

📝 توضیحات: ${scheduleJSON.LessonDescriptions === "" ? "<i>بدون توضیحات</i>" : scheduleJSON.LessonDescriptions}

👍 = حضور استاد
👎 = عدم حضور استاد
⏳ = تأخیر استاد`

  let replyMarkup_InlineButtons = {
    inline_keyboard: [
      [ 
        { text: "👍 (0)", callback_data: `SCH_OK_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }, 
        { text: "👎", callback_data: `SCH_NOK_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` },
        { text: "⏳", callback_data: `SCH_DELAY_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }
      ],
      [
        { text: "💬 ثبت نظر", callback_data: `SCH_COMNT_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }
      ],
      [
        { text: "🗝 پنل کنترل درس", callback_data: `SCH_ADMIN_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }
      ]
    ]
  }

  await Bot_SendTextMessage(env, await DB_Get_AnnouncementChannel(env), promptText_ScheduleStarted, replyMarkup_InlineButtons)
}

function System_Get_Shamsi_Date_String(gregorianDate)
{
  let shamsiJSON = System_Get_Shamsi_JSON(gregorianDate)
  return `${shamsiJSON.shamsi_Date.format("YYYY")}-${shamsiJSON.shamsi_Date.format("MM")}-${shamsiJSON.shamsi_Date.format("DD")}`
}

async function Prompt_InlineButtons_Schedule_AdminPanel(env, callback_query, scheduleJSON)
{
  // Check if callback_query contains a valid message.
  if("message" in callback_query)
  {
    let replyMarkup_AdminButtons = {
      inline_keyboard: [
        [ 
          { text: "📊 نمایش آراء", callback_data: `DISP_VOTES_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }, 
        ],
        [
          { text: "🗯 نمایش نظرات", callback_data: `DISP_COMNTS_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }, 
        ],
        [
          { text: "🔙 بازگشت 🔙", callback_data: `DISP_SCH_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }
        ]
      ]
    }

    await Bot_EditMessageReplyMarkup(env, callback_query.message.chat.id, callback_query.message.message_id, replyMarkup_AdminButtons)
    await Bot_AnswerCallbackQuery(env, callback_query.id, `نمایش پنل ادمین برای درس.\nحتما پس از اتمام کار، از دکمه بازگشت استفاده کنید.`, false)

    return true
  }

  // Return FALSE on error.
  return false
}

async function Prompt_InlineButtons_Schedule_Display(env, callback_query, scheduleJSON)
{
  // Check if callback_query contains a valid message.
  if("message" in callback_query)
    {
      let replyMarkup_ScheduleButtons = {
        inline_keyboard: [
          [ 
            { text: `👍 (${await DB_Get_Schedule_Votes_Count(env, scheduleJSON, new Date(), "Teacher Presence", "OK")})`, callback_data: `SCH_OK_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }, 
            { text: "👎", callback_data: `SCH_NOK_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` },
            { text: "⏳", callback_data: `SCH_DELAY_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }
          ],
          [
            { text: "💬 ثبت نظر", callback_data: `SCH_COMNT_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }
          ],
          [
            { text: "🗝 پنل کنترل درس", callback_data: `SCH_ADMIN_${scheduleJSON.LessonCode}_${scheduleJSON.PresentationCode}` }
          ]
        ]
      }
  
      await Bot_EditMessageReplyMarkup(env, callback_query.message.chat.id, callback_query.message.message_id, replyMarkup_ScheduleButtons)
      await Bot_AnswerCallbackQuery(env, callback_query.id, `بازگشت به پنل درس.`, false)
  
      return true
    }
  
    // Return FALSE on error.
    return false
}
