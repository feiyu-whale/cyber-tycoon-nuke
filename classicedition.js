function Square(name, pricetext, color, price, groupNumber, baserent, rent1, rent2, rent3, rent4, rent5) {
	this.name = name;
	this.pricetext = pricetext;
	this.color = color;
	this.owner = 0;
	this.mortgage = false;
	this.house = 0;
	this.hotel = 0;
	this.groupNumber = groupNumber || 0;
	this.price = (price || 0);
	this.baserent = (baserent || 0);
	this.rent1 = (rent1 || 0);
	this.rent2 = (rent2 || 0);
	this.rent3 = (rent3 || 0);
	this.rent4 = (rent4 || 0);
	this.rent5 = (rent5 || 0);
	this.landcount = 0;

	// 2026-10-18 中国版：盖房价按地价档位递增（越贵的地，盖房越贵）
	if (groupNumber === 3) {
		this.houseprice = 20000;       // 大三巴 / 老教堂 3600
	} else if (groupNumber === 4) {
		this.houseprice = 30000;       // 古城门 / 三拱廊桥 / 帕特农
	} else if (groupNumber === 5) {
		this.houseprice = 40000;       // 悉尼歌剧院 / 大理三塔 / 西式城堡
	} else if (groupNumber === 6) {
		this.houseprice = 60000;       // 中式城楼 / 市政厅 / 中银大厦
	} else if (groupNumber === 7) {
		this.houseprice = 80000;       // 埃菲尔 / 观光塔 / 长城
	} else if (groupNumber === 8) {
		this.houseprice = 100000;      // 凯旋门 / 圣殿 / 国会
	} else if (groupNumber === 9) {
		this.houseprice = 130000;      // 玛雅 / 宝塔 / 东方明珠
	} else if (groupNumber === 10) {
		this.houseprice = 180000;      // 大本钟 / 玻璃金字塔
	} else {
		this.houseprice = 0;
	}
}

function Card(text, action) {
	this.text = text;
	this.action = action;
}

// 2026-10-17 地标图标映射（索引 → 图标文件）
var LANDMARK_ICONS = {
	1:'b2.png', 3:'b10.png', 6:'b3.png', 8:'b6.png', 9:'b7.png',
	11:'b13.png', 13:'b20.png', 14:'b9.png', 16:'b11.png', 18:'b19.png',
	19:'b18.png', 21:'b1.png', 23:'b4.png', 24:'b5.png', 26:'b14.png',
	27:'b2.png', 29:'b12.png', 31:'b15.png', 32:'b16.png', 34:'b17.png',
	37:'b19-1.png', 39:'b8.png'
};

function corrections() {
	// 2026-10-17 给每块地产格插入地标图标（小图，放在格子底部）
	for (var idx in LANDMARK_ICONS) {
		var holder = document.getElementById("cell" + idx);
		if (!holder) continue;
		var img = document.createElement("img");
		img.src = "images/landmarks/" + LANDMARK_ICONS[idx];
		img.className = "cell-landmark";
		img.alt = "";
		holder.style.position = "relative";
		holder.insertBefore(img, holder.firstChild);
	}

	// Add images to enlarges.
	document.getElementById("enlarge5token").innerHTML += '<img src="images/train_icon.png" height="60" width="65" alt="" style="position: relative; bottom: 20px;" />';
	document.getElementById("enlarge15token").innerHTML += '<img src="images/train_icon.png" height="60" width="65" alt="" style="position: relative; top: -20px;" />';
	document.getElementById("enlarge25token").innerHTML += '<img src="images/train_icon.png" height="60" width="65" alt="" style="position: relative; top: -20px;" />';
	document.getElementById("enlarge35token").innerHTML += '<img src="images/train_icon.png" height="60" width="65" alt="" style="position: relative; top: -20px;" />';
	document.getElementById("enlarge12token").innerHTML += '<img src="images/electric_icon.png" height="60" width="48" alt="" style="position: relative; top: -20px;" />';
	document.getElementById("enlarge28token").innerHTML += '<img src="images/water_icon.png" height="60" width="78" alt="" style="position: relative; top: -20px;" />';
}

function utiltext() {
	return '拥有一家「公用事业」时，租金为骰子点数的 4 倍。<br /><br />两家「公用事业」都拥有时，租金为骰子点数的 10 倍。';
}

function transtext() {
	return '<div style="font-size: 14px; line-height: 1.5;">租金<span style="float: right;">$25</span><br />拥有 2 条铁路时<span style="float: right;">$50</span><br />拥有 3 条铁路时<span style="float: right;">$100</span><br />拥有 4 条铁路时<span style="float: right;">$200</span></div>';
}

function luxurytax() {
	// 2026-10-18 v23：奢侈税改为「固定 1500 + 总资产 5%」（老爹定：固定价+百分比）
	var p = player[turn];
	var _base1 = window.cashBase ? window.cashBase(p) : p.money;
	var tax = 1500 + Math.round(_base1 * 0.05);
	addAlert(p.name + " 落在奢侈税，缴纳 $" + tax + "（$1500 + 总资产 5%，含金币）。");
	p.pay(tax, 0);

	$("#landed").show().text("你落在了奢侈税。缴纳 $" + tax + "（$1500 + 总资产 5%，含金币）。");
}

function citytax() {
	// 2026-10-18 v23：城市税改为「固定 3000 + 总资产 10%」（老爹定：固定价+百分比）
	var p = player[turn];
	var _base2 = window.cashBase ? window.cashBase(p) : p.money;
	var tax = 3000 + Math.round(_base2 * 0.10);
	addAlert(p.name + " 落在城市税，缴纳 $" + tax + "（$3000 + 总资产 10%，含金币）。");
	p.pay(tax, 0);

	$("#landed").show().text("你落在了城市税。缴纳 $" + tax + "（$3000 + 总资产 10%，含金币）。");
}

var square = [];

square[0] = new Square("🎯 起点", "经过领 $10000 薪水", "#FFFFFF");
square[1] = new Square("🏯 大三巴牌坊", "$3600", "#8B4513",3600,3,1000,5000,15000,45000,80000,125000);
square[2] = new Square("🎴 机会", "抽一张卡", "#FFFFFF");
square[3] = new Square("⛪ 老教堂", "$3600", "#8B4513",3600,3,1000,5000,15000,45000,80000,112500);
square[4] = new Square("💸 城市税", "缴纳 $3000", "#FFFFFF");
square[5] = new Square("🚂 雷丁铁路", "$6000", "#FFFFFF",6000,1);
square[6] = new Square("🏯 古城门", "$5000", "#87CEEB",5000,4,1400,7000,21000,63000,93300,128300);
square[7] = new Square("❓ 命运", "抽一张卡", "#FFFFFF");
square[8] = new Square("🌉 三拱廊桥", "$5000", "#87CEEB",5000,4,1400,7000,21000,63000,93300,128300);
square[9] = new Square("🏛️ 帕特农神庙", "$15000", "#87CEEB",15000,4,1800,9000,22500,67500,101200,135000);
square[10] = new Square("👀 探监", "只是路过", "#FFFFFF");
square[11] = new Square("🎭 悉尼歌剧院", "$8000", "#FF0080",8000,5,2200,11000,33000,99000,137500,165000);
square[12] = new Square("💡 电力公司", "$4000", "#FFFFFF",4000,2);
square[13] = new Square("🛕 大理三塔", "$8000", "#FF0080",8000,5,2200,11000,33000,99000,137500,165000);
square[14] = new Square("🏯 西式城堡", "$9500", "#FF0080",9500,5,2600,13000,39000,108300,151700,195000);
square[15] = new Square("🚂 宾夕法尼亚铁路", "$6000", "#FFFFFF",6000,1);
square[16] = new Square("🏯 中式城楼", "$11000", "#FFA500",11000,6,3000,15000,42900,117900,160700,203600);
square[17] = new Square("🎴 机会", "抽一张卡", "#FFFFFF");
square[18] = new Square("🏛️ 市政厅钟楼", "$11000", "#FFA500",11000,6,3000,15000,42900,117900,160700,203600);
square[19] = new Square("🏙️ 中银大厦", "$13000", "#FFA500",13000,6,3600,18000,49500,135000,180000,225000);
square[20] = new Square("🅿️ 免费停车", "休息一下", "#FFFFFF");
square[21] = new Square("🗼 埃菲尔铁塔", "$16000", "#FF0000",16000,7,4200,21000,58300,163300,204200,245000);
square[22] = new Square("❓ 命运", "抽一张卡", "#FFFFFF");
square[23] = new Square("🗽 观光塔", "$16000", "#FF0000",16000,7,4200,21000,58300,163300,204200,245000);
square[24] = new Square("🏯 长城城墙", "$19000", "#FF0000",19000,7,5000,25000,75000,187500,231200,275000);
square[25] = new Square("🚂 B&O 铁路", "$6000", "#FFFFFF",6000,1);
square[26] = new Square("🏛️ 凯旋门", "$22000", "#FFFF00",22000,8,5800,29000,87000,210900,257000,303200);
square[27] = new Square("🕌 圣殿建筑", "$22000", "#FFFF00",22000,8,5800,29000,87000,210900,257000,303200);
square[28] = new Square("🚰 自来水厂", "$4000", "#FFFFFF",4000,2);
square[29] = new Square("🏛️ 国会大厦", "$26000", "#FFFF00",26000,8,6600,33000,99000,233700,281900,330000);
square[30] = new Square("🚔 进监狱", "直接进监狱，不领 $10000", "#FFFFFF");
square[31] = new Square("🔺 玛雅金字塔", "$30000", "#008000",30000,9,7600,38000,114000,263100,321500,372700);
square[32] = new Square("🏯 中式宝塔", "$30000", "#008000",30000,9,7600,38000,114000,263100,321500,372700);
square[33] = new Square("🎴 机会", "抽一张卡", "#FFFFFF");
square[34] = new Square("🗼 东方明珠", "$41200", "#008000",41200,9,9000,48200,144600,321400,385700,450000);
square[35] = new Square("🚂 短线铁路", "$6000", "#FFFFFF",6000,1);
square[36] = new Square("❓ 命运", "抽一张卡", "#FFFFFF");
square[37] = new Square("🕰️ 大本钟", "$45000", "#0000FF",45000,10,11000,55000,157100,345700,408600,471400);
square[38] = new Square("💸 奢侈税", "缴纳 $1500", "#FFFFFF");
square[39] = new Square("🔺 玻璃金字塔", "$48800", "#0000FF",48800,10,14000,56000,168000,392000,476000,560000);

var communityChestCards = [];
var chanceCards = [];

communityChestCards[0] = new Card("出狱许可证。可保留到需要时使用或出售。",function(p) { p.communityChestJailCard = true; updateOwned();});
communityChestCards[1] = new Card("你在选美比赛中获得二等奖，领取 $10。",function() { addamount(10, 'Community Chest');});
communityChestCards[2] = new Card("卖出股票，获得 $50。",function() { addamount(50, 'Community Chest');});
communityChestCards[3] = new Card("人寿保险到期，领取 $100。",function() { addamount(100, 'Community Chest');});
communityChestCards[4] = new Card("所得税退税，领取 $20。",function() { addamount(20, 'Community Chest');});
communityChestCards[5] = new Card("假日基金到期，领取 $100。",function() { addamount(100, 'Community Chest');});
communityChestCards[6] = new Card("你继承了 $100。",function() { addamount(100, 'Community Chest');});
communityChestCards[7] = new Card("收到 $25 咨询费。",function() { addamount(25, 'Community Chest');});
communityChestCards[8] = new Card("支付医院费用 $100。",function() { subtractamount(100, 'Community Chest');});
communityChestCards[9] = new Card("银行出错，多算了你的钱，领取 $200。",function() { addamount(200, 'Community Chest');});
communityChestCards[10] = new Card("支付学费 $50。",function() { subtractamount(50, 'Community Chest');});
communityChestCards[11] = new Card("看医生，支付 $50。",function() { subtractamount(50, 'Community Chest');});
communityChestCards[12] = new Card("今天是你的生日，每位玩家给你 $10。",function() { collectfromeachplayer(10, 'Community Chest');});
communityChestCards[13] = new Card("Advance to \"GO\" (Collect $200).", function() { advance(0);});
communityChestCards[14] = new Card("房屋大修：每栋房子 $40，每间旅馆 $115。",function() { streetrepairs(40, 115);});
communityChestCards[15] = new Card("进监狱。直接进监狱，不经过起点，不领 $200。", function() { gotojail();});


chanceCards[0] = new Card("出狱许可证。可保留到需要时使用或交易。",function(p) { p.chanceJailCard=true; updateOwned();});
chanceCards[1] = new Card("全屋大修：每栋房子 $25，每间旅馆 $100。",function() { streetrepairs(25, 100);});
chanceCards[2] = new Card("超速罚款 $15。",function() { subtractamount(15, 'Chance');});
chanceCards[3] = new Card("你被选为董事会主席，向每位玩家支付 $50。",function() { payeachplayer(50, 'Chance');});
chanceCards[4] = new Card("后退三格。",function() { gobackthreespaces();});
chanceCards[5] = new Card("前进到最近的自来水厂。若无人拥有，可向银行购买；若已拥有，掷骰子向业主支付点数的十倍。",function() { advanceToNearestUtility();});
chanceCards[6] = new Card("银行分红，领取 $50。",function() { addamount(50, 'Chance');});
chanceCards[7] = new Card("前进到最近的铁路。若无人拥有，可向银行购买；若已拥有，向业主支付两倍租金。",function() { advanceToNearestRailroad();});
chanceCards[8] = new Card("缴纳扶贫税 $15。",function() { subtractamount(15, 'Chance');});
chanceCards[9] = new Card("前往雷丁铁路。经过起点可领 $200。", function() { advance(5);});
chanceCards[10] = new Card("前进到木板路。",function() { advance(39);});
chanceCards[11] = new Card("ADVANCE to Illinois Avenue. If you pass \"GO\" collect $200.", function() { advance(24);});
chanceCards[12] = new Card("建筑贷款到期，领取 $150。",function() { addamount(150, 'Chance');});
chanceCards[13] = new Card("前进到最近的铁路。若无人拥有，可向银行购买；若已拥有，向业主支付两倍租金。",function() { advanceToNearestRailroad();});
chanceCards[14] = new Card("ADVANCE to St. Charles Place. If you pass \"GO\" collect $200.", function() { advance(11);});
chanceCards[15] = new Card("进监狱。直接进监狱，不经过起点，不领 $200。", function() { gotojail();});
