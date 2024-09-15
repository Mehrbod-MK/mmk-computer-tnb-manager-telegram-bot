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

// .TOML Variables.
const API_KEY = "7377397628:AAFNmab7t3Aqdv-o77rKMYTdyie7o_D9gCw";

export default
{
  fetch(request, env)
  {
    var response = handleRequest(request, env);
    return response;
  }
}

// Function for sending a message to a chat id.
async function Send_TextMessage(env, chat_id, text, reply_markup, parse_mode = "HTML")
{
  let messageJSON = 
  {
    chat_id,
    text,
    reply_markup,
    parse_mode
  }

  const url = `https://api.telegram.org/bot${API_KEY}/sendMessage`
  
  const data = await fetch(url,
    {
      method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageJSON)
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

      // Route -> Macro Command.
      if(await Route_MacroCommand(env, message) === true)
      {
        return new Response("OK")
      }

      let chatType = message.chat.type

      if(chatType === "private")
      {
        let chatId = message.from.id

        // Route -> Creator.
        if(await Route_PrivateChat_IsCreator(env, message) === true)
        {
          return new Response("OK")
        }

        // Route -> Private Chat -> New User
        if(await Route_PrivateChat_NonRegisteredUser(env, message) === true)
        {
          return new Response("OK")
        }
      }
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
   
    
  // Prompt bad input command if all routings fail.
  await Prompt_BadInputCommand(env, payload.message)

  }

  return new Response("OK")
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
    
      await Send_TextMessage(env, message.chat.id, prompt_ChatIdText, {})

      return true
    }

    // /mmk_comptnb_getUserId
    if(loweredText === "/mmk_comptnb_getuserid")
    {
      if("from" in message)
      {
        let prompt_UserIdText = `🔑 شماره انحصاری نشست کاربری:\n<code>${message.from.id}</code>`
        await Send_TextMessage(env, message.chat.id, prompt_UserIdText, {})
      }
      else
      {
        await Send_TextMessage(env, message.chat.id, "🚫 شماره نشست کاربری فقط از طریق ارسال پیام خصوصی به بات امکان‌پذیر می‌باشد.", {})
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
          await Send_TextMessage(env, message.chat.id, "❌ مقدار شماره کانال تنظیم شده معتبر نیست.\n\n👈 از /start استفاده کنید.")
          return true
        }

        // Send a test message to specified channel.
        let promptText_TestMessage = `✅ پیام تست ارسال شده.\n\n👈 از طرف:  <b>${message.from.first_name}</b>\n📅 تاریخ: <b>${System_GetDateTime_NumericPersianString(new Date())}</b>`
        await Send_TextMessage(env, channelID, promptText_TestMessage, {})
        await Send_TextMessage(env, message.chat.id, `✅ پیام تست با موفقیت ارسال شد.\n\n⚠ <i>در صورت عدم مشاهده پیام، یعنی بات را به کانال اضافه نکرده‌اید یا دسترسی ارسال پیام بات در کانال را بسته‌اید.</i>`, {})

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

    await Send_TextMessage(env, message.chat.id, text_WelcomeMenu, replyMarkup_WelcomeMenuKeyboard)

    return true
  }

  return false
}

async function Prompt_BadInputCommand(env, message)
{

  let text_BadInput = `🚫 دستور وارد شده در این لحظه قابل پردازش نیست.
  
  👈 می‌توانید از /start استفاده کنید.`

  await Send_TextMessage(env, message.chat.id, text_BadInput, {})
}

async function Prompt_Creator_SetChannel(env, message)
{
  let channelID = await DB_Get_AnnouncementChannel(env)

  let promptText_SetChannel = `<b>👈 تنظیم کانال اطلاع‌رسانی بات</b>

  ${(channelID === null || isNaN(channelID) === true) ? `🔵 کانالی تنظیم نشده است.` : `🟢 شماره چت کانال:  <code>${channelID}</code>`}
  
  👇 حال، می‌توانید با وارد کردن شماره چت کانال جدید، آن را جهت اطلاع رسانی بات تنظیم کنید.`

  await Send_TextMessage(env, message.chat.id, promptText_SetChannel, { keyboard: [[{ text: "❌ حذف کانال تنظیم شده فعلی در صورت وجود" }], [{text: "🔙 بازگشت به منوی قبلی"}]]})
}

async function Prompt_SetAnnouncementChannel(env, message, newChannelID)
{
  let prompt_SetChannelID = `✅ کانال اطلاع‌رسانی با موفقیت به شماره 
  <code>${newChannelID}</code>
  تنظیم شد.
  
  👈 می‌توانید با استفاده از دستور /test_channel، یک پیام آزمایشی به کانال تنظیم شده توسط بات ارسال کنید.
  
  <i><b>⚠ در صورت بروز هر گونه اشکال، می‌توانید از دستور /help استفاده کنید.</b></i>`

  await Send_TextMessage(env, message.chat.id, prompt_SetChannelID, { remove_keyboard: true })
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
          
    await Send_TextMessage(env, message.chat.id, text_CreatorMenu, replyMarkup_CreatorMenu)
}

async function Prompt_RemovedAnnouncementChannelID(env, message)
{
  let promptText_RemovedChannel = `☑ کانال با موفقیت حذف شد.`

  await Send_TextMessage(env, message.chat.id, promptText_RemovedChannel, {})
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
    second: 'numeric'
  }

  return date.toLocaleString('fa-IR', options)
}
