process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 0;

const express = require('express')
const TelegramBot = require('node-telegram-bot-api')
const { parseTime } = require('./utils/time')
const { fetchImage } = require('./utils/request')
const { linkify } = require('./utils/string')
const { getCryptoRanking } = require('./lib/crypto-ranking')
const ApiService = require('./utils/request').ApiService
const app = express()
const port = 8000
const env = require('dotenv').config({
  debug: true,
  path: ['.env', process.env.NODE_MODE === 'development' ? '.env.development' : '.env.production']
}).parsed;

const token = process.env.TOKEN || env.TOKEN
const apiService = ApiService.getInstance()

app.listen(port, async () => {
  console.log('✨✨ start ----------------------')
  const bot = new TelegramBot(token, { polling: true })
  /**
   * 数据记录id
   */
  let cacheId = ''
  /**
   * 频道 id
   */
  const chatId = process.env.CHATID || env.CHATID
  /**
   * 避免数据还没发送就开始了下一次的发送
   */
  let isEnd = true

  /**
   * 统计次数
   */
  let count = 0

  setInterval(async () => {
    if (!isEnd) return

    const { data } = await apiService.request({
      url: 'https://chaininsight.vip/api/v0/query/moment',
      method: 'GET',
      params: {
        pageNum: 1,
        pageSize: 10,
      },
    })

    const list = [...(data?.list || [])].reverse()


    /**
     * 接口没返回数据就 return
     */
    if (!list.length) return

    /**
 * 删除发送过的数据
 */
    const cacheIndex = list.findIndex(item => item.id === cacheId)
    if (cacheIndex >= 0) {
      list.splice(0, cacheIndex + 1)
    }

    if (!list.length) return
    cacheId = list[list.length - 1].id
    isEnd = false

    /**
     * 将列表拆成二维数组
     */
    const groupedData = []
    let currentGroup = []

    for (let item of list) {
      if (item.images.length > 0) {
        // 将当前分组添加到 groupedData
        if (currentGroup.length > 0) {
          groupedData.push(currentGroup)
        }

        // 遍历 image 数组并读取图片到内存
        const images = []
        for (let url of item.images) {
          const file = await fetchImage(url)
          if (file) {
            images.push(file)
          }
        }
        item.images = images

        // 创建新的分组，并将当前 item 添加到新分组
        groupedData.push([item])
        currentGroup = []
      } else {
        // 将当前 item 添加到当前分组
        currentGroup.push(item)
      }
    }

    // 将最后一个分组添加到 groupedData
    if (currentGroup.length > 0) {
      groupedData.push(currentGroup)
      currentGroup = []
    }

    for (let items of groupedData) {
      if (items[0].images.length === 0) {
        const text = items.map(
          (item, index) => {
            return `\n<b>${item.kolInfo.name}</b> ${parseTime(Number(item.createTime), '{y}-{m}-{d} {h}:{i}')} \n<blockquote>${linkify(item.content)}</blockquote> <b>[${item.tagInfos.map(tag => tag.name).join(']</b> <b>[')}]</b>\n`
          }
        )
          .join('')

        if (text) {
          try {
            await bot.sendMessage(chatId, text, {
              parse_mode: 'HTML'
            })
          } catch (err) {
            console.error('[sendMessage] error', err, err.code, err.response.body.description)
          }
        }
        /**
         * 单图
         */
      } else if (items[0].images.length === 1) {
        try {
          await bot.sendPhoto(chatId, items[0].images[0], {
            parse_mode: 'HTML',
            caption: `\n<b>${items[0].kolInfo.name}</b> ${parseTime(Number(items[0].createTime), '{y}-{m}-{d} {h}:{i}')} \n<blockquote>${linkify(items[0].content)}</blockquote> <b>[${items[0].tagInfos.map(tag => tag.name).join(']</b> <b>[')}]</b>\n`
          })
        } catch (err) {
          console.error('[sendPhoto] error', err.code, err.response.body.description)
        }

        items[0].images[0].fill(0)
        items[0].images[0] = null
        /**
         * 多图
         */
      } else {
        try {
          await bot.sendMediaGroup(chatId, items[0].images.map((buffer, index) => ({
            type: 'photo',
            media: buffer,
            parse_mode: 'HTML',
            caption: index !== 0 ? '' : `\n<b>${items[0].kolInfo.name}</b> ${parseTime(Number(items[0].createTime), '{y}-{m}-{d} {h}:{i}')} \n<blockquote>${linkify(items[0].content)}</blockquote> <b>[${items[0].tagInfos.map(tag => tag.name).join(']</b> <b>[')}]</b>${index == items[0].images.length - 1 ? '' : '\n'}`
          })))
        } catch (err) {
          console.error('[sendMediaGroup] error', err, err.response)
        }
        items[0].images.forEach((buffer) => {
          buffer.fill(0)
          buffer = null
        })
      }
    }
    console.log('执行完成')
    isEnd = true
  }, 10000)

  try {
    const data = await getCryptoRanking()
    bot.sendMessage('@message_collect_crypto_ranking', data, {
      parse_mode: 'HTML'
    })
  } catch(err) {
    console.log(err)
  }
  setInterval(async () => {
    try {
      const data = await getCryptoRanking()
      bot.sendMessage('@message_collect_crypto_ranking', data, {
        parse_mode: 'HTML'
      })
    } catch(err) {
      console.log(err)
    }
  }, 1000 * 60 * 10)
})
