export interface AchievementItem { id: string; title: string; condition: string; backMessage: string; }
export interface AchievementGroup { id: string; title: string; items: ReadonlyArray<AchievementItem>; }

// The hidden eighty-first entry only appears after its independent discovery event.
export const SPECIAL_ACHIEVEMENT: AchievementItem = {
  id: 'special-shadowless', title: '无影烟',
  condition: '有烟无影， 有形无踪',
  backMessage: '你已经见过所有烟雾，\n却找不到最后一缕烟。',
};

// Titles, conditions and back messages transcribed from the legacy achievement catalog.
export const ACHIEVEMENT_GROUPS: ReadonlyArray<AchievementGroup> = [
  {
    "id": "experience",
    "title": "烟雾体验",
    "items": [
      {
        "id": "experience-entry",
        "title": "初入烟境",
        "condition": "从烟盒取出第一根烟。",
        "backMessage": "欢迎来这里歇一会儿，别的事慢慢再说。"
      },
      {
        "id": "experience-ten",
        "title": "十根之后",
        "condition": "累计体验并结束10根烟。",
        "backMessage": "忙里能给自己留一点空，也是一种照顾。"
      },
      {
        "id": "experience-hundred",
        "title": "百根往事",
        "condition": "累计体验并结束100根烟。",
        "backMessage": "这些平常的小片刻，也值得被认真记住。"
      }
    ]
  },
  {
    "id": "rings",
    "title": "烟圈探索",
    "items": [
      {
        "id": "rings-circle",
        "title": "圆满开始",
        "condition": "吐出一次圆形烟圈。",
        "backMessage": "生活不必处处圆满，今天的你已经很好。"
      },
      {
        "id": "rings-heart",
        "title": "心意有形",
        "condition": "吐出一次爱心烟圈。",
        "backMessage": "把温柔分给别人，也记得给自己留一点。"
      },
      {
        "id": "rings-square",
        "title": "有棱有角",
        "condition": "吐出一次方形烟圈。",
        "backMessage": "有自己的棱角，也不妨碍你被喜欢。"
      },
      {
        "id": "rings-flowers",
        "title": "花开两样",
        "condition": "试试花瓣和四叶草烟圈。",
        "backMessage": "花开有早晚，你也有自己的时节。"
      },
      {
        "id": "rings-water-cloud",
        "title": "云水之间",
        "condition": "试试水滴和云朵烟圈。",
        "backMessage": "心事可以像云一样，慢慢散开。"
      },
      {
        "id": "rings-moon-infinity",
        "title": "月有回环",
        "condition": "试试月牙和无限烟圈。",
        "backMessage": "有些路绕了一点，也不算白走。"
      },
      {
        "id": "rings-butterfly-smile",
        "title": "蝶来一笑",
        "condition": "试试蝴蝶和笑脸烟圈。",
        "backMessage": "不用强撑着开心，轻轻松一口气也好。"
      },
      {
        "id": "rings-snow-note",
        "title": "雪落成歌",
        "condition": "试试雪花和音符烟圈。",
        "backMessage": "愿安静的日子里，也有让你喜欢的声音。"
      },
      {
        "id": "rings-ten-shapes",
        "title": "百变烟圈",
        "condition": "体验10种不同的烟圈。",
        "backMessage": "今天换个样子，也不用急着给自己下定义。"
      },
      {
        "id": "rings-all-shapes",
        "title": "烟圈大师",
        "condition": "体验全部13种烟圈。",
        "backMessage": "你发现的小小花样，也能装点平常的一天。"
      }
    ]
  },
  {
    "id": "ash",
    "title": "烟灰艺术",
    "items": [
      {
        "id": "ash-stardust",
        "title": "星辰落下",
        "condition": "用星屑烟灰弹一次灰。",
        "backMessage": "再小的一点光，也值得被看见。"
      },
      {
        "id": "ash-meteor",
        "title": "流星划过",
        "condition": "用流星烟灰弹一次灰。",
        "backMessage": "有些美好停得很短，也不妨碍它来过。"
      },
      {
        "id": "ash-sakura",
        "title": "樱花散落",
        "condition": "用落樱烟灰弹一次灰。",
        "backMessage": "慢一点吧，花瓣也不是一下就落到地上的。"
      },
      {
        "id": "ash-snow",
        "title": "初雪",
        "condition": "用雪花烟灰弹一次灰。",
        "backMessage": "愿今天的纷扰，像雪落下时一样轻一点。"
      },
      {
        "id": "ash-crystal",
        "title": "晶砂微光",
        "condition": "用晶砂烟灰弹一次灰。",
        "backMessage": "你的光，不必等到被夸奖才算数。"
      },
      {
        "id": "ash-glow",
        "title": "萤火微光",
        "condition": "用萤光烟灰弹一次灰。",
        "backMessage": "微弱也没关系，有一点光就很好。"
      },
      {
        "id": "ash-dandelion",
        "title": "风中种子",
        "condition": "用蒲公英烟灰弹一次灰。",
        "backMessage": "暂时没有方向，也可以先让自己松一松。"
      },
      {
        "id": "ash-pixel",
        "title": "像素时代",
        "condition": "用像素烟灰弹一次灰。",
        "backMessage": "不是画质问题，是复古得很认真。"
      },
      {
        "id": "ash-heart",
        "title": "爱心发射",
        "condition": "用爱心烟灰弹一次灰。",
        "backMessage": "被温柔对待这件事，你也有份。"
      },
      {
        "id": "ash-all",
        "title": "灰烬艺术家",
        "condition": "体验全部12种烟灰。",
        "backMessage": "平常得不起眼的事，也能藏着一点趣味。"
      }
    ]
  },
  {
    "id": "lab",
    "title": "实验与操作",
    "items": [
      {
        "id": "lab-color",
        "title": "调色师",
        "condition": "保存并体验一种新烟雾颜色。",
        "backMessage": "今天是什么颜色，都可以被好好接住。"
      },
      {
        "id": "lab-box",
        "title": "本盒专属",
        "condition": "保存并使用本盒专属方案。",
        "backMessage": "给自己留一点专属的偏爱，并不过分。"
      },
      {
        "id": "lab-type",
        "title": "烟种设计师",
        "condition": "保存并使用本烟种方案。",
        "backMessage": "你喜欢的样子，不必向谁解释。"
      },
      {
        "id": "lab-global",
        "title": "全局大师",
        "condition": "保存并使用全局方案。",
        "backMessage": "愿你喜欢的颜色，也能染亮平常的日子。"
      },
      {
        "id": "lab-styles",
        "title": "吐雾研究员",
        "condition": "体验全部6种吐雾方式。",
        "backMessage": "换一种方式，不代表之前的路白走了。"
      },
      {
        "id": "lab-amount",
        "title": "轻重有度",
        "condition": "体验全部3档烟量。",
        "backMessage": "不必每次都用尽力气，轻一点也可以。"
      },
      {
        "id": "lab-hand",
        "title": "拨雾者",
        "condition": "用手指拨动一次烟雾。",
        "backMessage": "有些心事，轻轻拨开一点就够了。"
      },
      {
        "id": "lab-direction",
        "title": "左右开弓",
        "condition": "向左、向右各吐一次烟圈。",
        "backMessage": "往哪边走都可以，别忘了照顾走路的自己。"
      },
      {
        "id": "lab-formations",
        "title": "烟雾导演",
        "condition": "体验全部4种烟圈编队。",
        "backMessage": "生活偶尔乱了节奏，也不代表你演得不好。"
      }
    ]
  },
  {
    "id": "days",
    "title": "打卡与陪伴",
    "items": [
      {
        "id": "days-one",
        "title": "第一张票",
        "condition": "完成第一次打卡。",
        "backMessage": "今天愿意来看看自己，就已经很好。"
      },
      {
        "id": "days-three",
        "title": "三日同行",
        "condition": "累计打卡3天。",
        "backMessage": "不声不响地坚持，也值得被记住。"
      },
      {
        "id": "days-seven",
        "title": "七张存根",
        "condition": "累计打卡7天。",
        "backMessage": "这一周辛苦了，给自己留一点轻松吧。"
      },
      {
        "id": "days-fifteen",
        "title": "半月相伴",
        "condition": "累计打卡15天。",
        "backMessage": "走过半个月，也别忘了停下来喘口气。"
      },
      {
        "id": "days-thirty",
        "title": "一月相伴",
        "condition": "累计打卡30天。",
        "backMessage": "一个月里的那些小努力，没有白费。"
      },
      {
        "id": "days-hundred",
        "title": "百日同行",
        "condition": "累计打卡100天。",
        "backMessage": "日子是一点点走过来的，你也是。"
      },
      {
        "id": "days-year",
        "title": "一年存档",
        "condition": "累计打卡365天。",
        "backMessage": "走过四季的你，也值得被温柔地纪念。"
      },
      {
        "id": "days-streak-seven",
        "title": "连续出票",
        "condition": "连续打卡7天。",
        "backMessage": "你认真赴约的日子，都留下了痕迹。"
      },
      {
        "id": "days-streak-thirty",
        "title": "坚持之人",
        "condition": "连续打卡30天。",
        "backMessage": "能坚持很好，偶尔停一下也不必责怪自己。"
      }
    ]
  },
  {
    "id": "packs",
    "title": "烟盒收藏",
    "items": [
      {
        "id": "packs-first",
        "title": "第一盒烟",
        "condition": "拥有第一盒烟。",
        "backMessage": "新的故事不用很大，从一点点开始就好。"
      },
      {
        "id": "packs-empty-one",
        "title": "第一空盒",
        "condition": "完整用完第一盒烟。",
        "backMessage": "这一段到这里，也可以安心画个句号。"
      },
      {
        "id": "packs-empty-three",
        "title": "三盒归档",
        "condition": "累计完整用完3盒烟。",
        "backMessage": "走过的几段路，慢慢都有了自己的名字。"
      },
      {
        "id": "packs-five-owned",
        "title": "五盒收藏",
        "condition": "同时收藏5种有余量的烟。",
        "backMessage": "喜欢的东西慢慢攒，不用一次就齐全。"
      },
      {
        "id": "packs-unlocked-all",
        "title": "全盒收藏",
        "condition": "解锁全部8种烟。",
        "backMessage": "原来耐心收集的小事，也会有圆满的一天。"
      },
      {
        "id": "packs-each-one",
        "title": "新玩家",
        "condition": "全部8种烟各完整用完1盒。",
        "backMessage": "不必急着成为老手，每一次初见都值得留下。"
      },
      {
        "id": "packs-thirty",
        "title": "烟盒达人",
        "condition": "累计完整用完30盒烟。",
        "backMessage": "你的认真，藏在这些一点点留下的记录里。"
      },
      {
        "id": "packs-hundred",
        "title": "百盒之旅",
        "condition": "累计完整用完100盒烟。",
        "backMessage": "走过这么长一段，也记得把目光留给窗外。"
      },
      {
        "id": "packs-each-ten",
        "title": "老玩家",
        "condition": "全部8种烟各完整用完10盒。",
        "backMessage": "走得久了，也别忘了照顾刚出发时的自己。"
      }
    ]
  },
  {
    "id": "social",
    "title": "朋友之间",
    "items": [
      {
        "id": "social-ordinary-share",
        "title": "分享一下",
        "condition": "分享一次小程序。",
        "backMessage": "想把有趣的事告诉别人，本身就很可爱。"
      },
      {
        "id": "social-send-one",
        "title": "第一次递烟",
        "condition": "第一次给朋友递烟。",
        "backMessage": "一点小小的心意，也有自己的温度。"
      },
      {
        "id": "social-send-ten",
        "title": "递出心意",
        "condition": "累计给朋友递烟10次。",
        "backMessage": "愿你递出的善意，也能轻轻回到你身边。"
      },
      {
        "id": "social-receive-one",
        "title": "有人递来一根",
        "condition": "第一次接过朋友递来的烟。",
        "backMessage": "有人把你放在心上，哪怕只是一个小小动作。"
      },
      {
        "id": "social-receive-ten",
        "title": "十根心意",
        "condition": "累计接过朋友递来的10根烟。",
        "backMessage": "这些被记起的时刻，都是平常日子里的暖意。"
      },
      {
        "id": "social-receive-hundred",
        "title": "百根情谊",
        "condition": "累计接过朋友递来的100根烟。",
        "backMessage": "来来往往的心意，也给日子添了一点温度。"
      },
      {
        "id": "social-same-friend",
        "title": "老朋友",
        "condition": "接过同一位朋友递来的30根烟。",
        "backMessage": "被人记得，是平常日子里很暖的事。"
      },
      {
        "id": "social-five-friends",
        "title": "熟人圈",
        "condition": "接过5位不同朋友递来的烟。",
        "backMessage": "世界很大，能有几次相逢已经很好。"
      },
      {
        "id": "social-store",
        "title": "先替我留着",
        "condition": "把朋友递来的烟存进散烟盒。",
        "backMessage": "有些心意不用马上回应，先好好收着。"
      },
      {
        "id": "social-resume",
        "title": "心意不落空",
        "condition": "取出并体验存下的好友烟。",
        "backMessage": "你认真接住的心意，也值得被轻轻记上一笔。"
      }
    ]
  },
  {
    "id": "quit",
    "title": "线下克制",
    "items": [
      {
        "id": "quit-one",
        "title": "今天算一天",
        "condition": "记录第一个未抽烟日。",
        "backMessage": "今天的这一步，已经值得肯定。"
      },
      {
        "id": "quit-three",
        "title": "三天有迹",
        "condition": "累计记录3个未抽烟日。",
        "backMessage": "不用一下走很远，这几步已经算数。"
      },
      {
        "id": "quit-seven",
        "title": "一周留白",
        "condition": "累计记录7个未抽烟日。",
        "backMessage": "这一周的克制，值得对自己说声辛苦了。"
      },
      {
        "id": "quit-fourteen",
        "title": "两周清醒",
        "condition": "累计记录14个未抽烟日。",
        "backMessage": "你为自己做的改变，正在一点点留下痕迹。"
      },
      {
        "id": "quit-thirty",
        "title": "月度档案",
        "condition": "累计记录30个未抽烟日。",
        "backMessage": "不必把一个月过得完美，认真照顾自己就很好。"
      },
      {
        "id": "quit-hundred",
        "title": "百日清风",
        "condition": "累计记录100个未抽烟日。",
        "backMessage": "一路走来不容易，记得肯定认真生活的自己。"
      },
      {
        "id": "quit-streak-seven",
        "title": "完整一周",
        "condition": "连续记录7天未抽烟。",
        "backMessage": "一整周的坚持，值得你为自己高兴一下。"
      },
      {
        "id": "quit-streak-thirty",
        "title": "一个月的留白",
        "condition": "连续记录30天未抽烟。",
        "backMessage": "这一路的耐心，只有你最清楚它的分量。"
      },
      {
        "id": "quit-feelings-three",
        "title": "给今天留句话",
        "condition": "在3个未抽烟日留下感受。",
        "backMessage": "有些话说不出口，写给自己也很好。"
      },
      {
        "id": "quit-feelings-ten",
        "title": "心情存档",
        "condition": "在10个未抽烟日留下感受。",
        "backMessage": "那些被你写下的心情，都值得被认真听见。"
      }
    ]
  },
  {
    "id": "mysteries",
    "title": "雾中奇遇",
    "items": [
      {
        "id": "experience-thousand",
        "title": "千根如梦",
        "condition": "累计体验并结束1000根烟。",
        "backMessage": "来过这么多次，愿你在屏幕之外也能轻松一点。"
      },
      {
        "id": "experience-puffs-thousand",
        "title": "千口云烟",
        "condition": "累计完成1000口吸入与呼出。",
        "backMessage": "愿你下一次叹气，只是因为终于放松下来。"
      },
      {
        "id": "experience-slow",
        "title": "慢慢来",
        "condition": "让一根烟陪你超过5分钟。",
        "backMessage": "不用每一步都赶路，歇一会儿也没关系。"
      },
      {
        "id": "experience-default",
        "title": "低调玩家",
        "condition": "用默认方案完整体验10根烟。",
        "backMessage": "不必变得耀眼，你也值得被看见。"
      },
      {
        "id": "experience-night",
        "title": "深夜烟雾",
        "condition": "在3个深夜来这里歇一会儿。",
        "backMessage": "这么晚还没休息，今天也辛苦了。"
      },
      {
        "id": "experience-dawn",
        "title": "清晨第一缕",
        "condition": "在3个清晨来这里歇一会儿。",
        "backMessage": "天刚亮，愿今天对你温柔一点。"
      },
      {
        "id": "experience-rain-night",
        "title": "雨夜漫步",
        "condition": "在3个夜晚体验大雨中的烟雾。",
        "backMessage": "听一会儿雨声吧，暂时不用回答世界。"
      },
      {
        "id": "lab-twenty-combinations",
        "title": "实验狂人",
        "condition": "体验20套不同烟雾组合。",
        "backMessage": "调了这么多套，最满意的还是下一套。"
      },
      {
        "id": "days-old-friend",
        "title": "戒烟老友",
        "condition": "累计来过这里180天。",
        "backMessage": "谢谢你又来，愿你的日子一天比一天轻松。"
      },
      {
        "id": "packs-full-set",
        "title": "全系列收藏",
        "condition": "同时收藏8种满盒烟。",
        "backMessage": "你认真留住的这些小事，都有自己的分量。"
      }
    ]
  }
];
