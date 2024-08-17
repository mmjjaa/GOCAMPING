const $con = document.getElementById("Con");
const $map = document.getElementById("map");
const $logo = document.getElementById("logo");
const $campList = document.getElementById("campList");

const $campDetails = document.getElementById("campDetails");
const $searchInput = document.getElementById("searchInput");
const $campTitle = document.getElementById("campTitle");
const $showAllButton = document.getElementById("showAllButton");
const $toggleSidebar = document.getElementById("toggleSidebar");
let isDoubleClick = false; // 모든, 내 지역 캠핑장 보기 버튼 더블클릭 방지

// 사용자 위치를 받지 못했을 때 기본 위치
const defaultLat = 36.5;
const defaultLng = 127.5;
let map, clusterer;
let isShowingAll = false;

// 클러스터러 설정, 사용자 위치 기반 마커
const initMap = (lat, lng) => {
  const mapOption = {
    center: new kakao.maps.LatLng(lat, lng),
    level: 9,
  };

  map = new kakao.maps.Map($map, mapOption);

  clusterer = new kakao.maps.MarkerClusterer({
    map: map,
    averageCenter: true,
    minLevel: 8,
    styles: [
      {
        width: "53px",
        height: "52px",
        backgroundColor: "rgba(51, 204, 255, 0.5)",
        borderRadius: "50%",
        color: "#000",
        textAlign: "center",
        lineHeight: "54px",
        fontSize: "14px",
        fontWeight: "bold",
      },
    ],
  });

  loadMarkers(lat, lng);

  kakao.maps.event.addListener(map, "bounds_changed", () => {
    if (!isShowingAll) {
      loadMarkers(lat, lng);
    }
  });

  // 검색어 입력 시 캠핑장 리스트에서 필터링
  const searchInputFn = (event) => {
    const query = event.target.value.trim().toLowerCase();
    if ($campList.style.display === "none") {
      $campList.style.display = "block";
      $campDetails.style.display = "none";
    }
    searchCamps(query, map);
  };
  $searchInput.addEventListener("input", (event) => {
    searchInputFn(event);
  });

  $campList.style.display = "block";

  // 로고 클릭 시 새로고침
  $logo.addEventListener("click", () => {
    window.location.reload();
  });

  // 버튼 클릭 시 모든 캠핑장 또는 내 지역 캠핑장 로드
  const showAllButtonFn = () => {
    if (isDoubleClick) return;
    isDoubleClick = true;

    if (isShowingAll) {
      getUserLocation();
      $campTitle.textContent = '"내 지역"에 가까운 캠핑장';
      $showAllButton.textContent = "모든 캠핑장 보기";
    } else {
      loadAllMarkers();
      $campTitle.textContent = "모든 캠핑장";
      $showAllButton.textContent = '"내 지역"에 가까운 캠핑장 보기';
    }
    isShowingAll = !isShowingAll;

    setTimeout(() => {
      isDoubleClick = false;
    }, 1000);
  };

  $showAllButton.addEventListener("click", () => {
    showAllButtonFn();
  });
};
// 마커 생성 함수
const createMarkers = (data) => {
  const markers = [];

  for (let i = 0; i < data.length; i++) {
    const lat = parseFloat(data[i].mapY);
    const lng = parseFloat(data[i].mapX);

    const markerPosition = new kakao.maps.LatLng(lat, lng);

    const imageSrc = "./img/tent.svg";
    const imageSize = new kakao.maps.Size(24, 35);
    const imageOption = { offset: new kakao.maps.Point(12, 35) };

    const markerImage = new kakao.maps.MarkerImage(
      imageSrc,
      imageSize,
      imageOption
    );

    const marker = new kakao.maps.Marker({
      position: markerPosition,
      image: markerImage,
    });

    markers.push(marker);

    const infowindow = new kakao.maps.InfoWindow({
      content: `<div style="width:150px;text-align:center;padding:5px;font-size:12px;font-weight:bold;border:2px solid rgba(223, 254, 255, 0.5);">${data[i].facltNm}</div>`,
    });

    kakao.maps.event.addListener(
      marker,
      "mouseover",
      makeOverListener(map, marker, infowindow)
    );
    kakao.maps.event.addListener(
      marker,
      "mouseout",
      makeOutListener(infowindow)
    );

    kakao.maps.event.addListener(marker, "click", () => {
      map.setCenter(marker.getPosition());
      map.setLevel(5);

      $campList.style.display = "none";
      $campDetails.style.display = "block";

      CampDetails(data[i]);
    });

    addCampList(data[i], marker, map);
  }

  return markers;
};

// 사용자 위치 기반 마커
const loadMarkers = async (lat, lng) => {
  const url = `https://apis.data.go.kr/B551011/GoCamping/locationBasedList?numOfRows=1000&pageNo=1&MobileOS=ETC&MobileApp=AppTest&serviceKey=&mapX=${lng}&mapY=${lat}&radius=10000&_type=json`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const data = json.response.body.items.item;

    $campList.innerHTML = "";

    if (data.length === 0) {
      $campList.innerHTML = "<li>주변 캠핑장을 찾을 수 없습니다.</li>";
      return;
    }

    const markers = createMarkers(data);

    clusterer.clear();
    clusterer.addMarkers(markers);
  } catch (error) {
    console.error("Error:", error);
  }
};

// 모든 캠핑장 마커
const loadAllMarkers = async () => {
  const url = `https://apis.data.go.kr/B551011/GoCamping/basedList?numOfRows=1000&pageNo=1&MobileOS=ETC&MobileApp=AppTest&serviceKey=&_type=json`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const data = json.response.body.items.item;

    $campList.innerHTML = "";

    const markers = createMarkers(data);

    clusterer.clear();
    clusterer.addMarkers(markers);
  } catch (error) {
    console.error("Error:", error);
  }
};

const makeOverListener = (map, marker, infowindow) => {
  return () => {
    infowindow.open(map, marker);
  };
};

const makeOutListener = (infowindow) => {
  return () => {
    infowindow.close();
  };
};

//li에 캠핑장 추가
const addCampList = (campData, marker, map) => {
  const listItem = document.createElement("li");
  listItem.className = "campItem";
  listItem.innerHTML = `<strong>${campData.facltNm}</strong><br>${campData.addr1}`;
  listItem.addEventListener("click", () => {
    map.setCenter(marker.getPosition());
    map.setLevel(5);
    kakao.maps.event.trigger(marker, "mouseover");

    $campList.style.display = "none";
    $campTitle.style.display = "none";
    $showAllButton.style.display = "none";
    $campDetails.style.display = "block";

    CampDetails(campData);
  });
  $campList.appendChild(listItem);
};

//클릭한 캠핑장 상세정보
const CampDetails = (campData) => {
  let firstImageUrl = campData.firstImageUrl || "./img/noimage.png";
  let facltNm = campData.facltNm || "캠핑장 이름 없음";
  let addr1 = campData.addr1 || "주소 정보 없음";
  let intro = campData.intro || "소개 정보 없음";
  let homepage = campData.homepage
    ? `<a href="${campData.homepage}" target="_blank">${campData.homepage}</a>`
    : "홈페이지 정보 없음";
  let manageSttus = campData.manageSttus || "운영 상태 정보 없음";
  let direction = campData.direction || "오시는 길 정보 없음";
  let resveCl = campData.resveCl || "예약 방법 정보 없음";
  let caravInnerFclty = campData.caravInnerFclty || "내부 시설 정보 없음";
  let sbrsEtc = campData.sbrsEtc || "기타 시설 정보 없음";
  let animalCmgCl = campData.animalCmgCl || "반려동물 동반 정보 없음";

  $campDetails.innerHTML = `
  <h2>${facltNm}</h2>
  <div class="detailCon">
    <img src="${firstImageUrl}" />
    <div class="intro">
      <span>${addr1}</span>
      <span>${intro}</span>
    </div>
  </div>
  <p><img src="./img/home_icon.png" ><strong>홈페이지&nbsp;&nbsp;</strong><span style="color: #0b75ad;font-weight:bold;">${homepage}</span></p>
  <p><img src="./img/clock_icon.png" ><strong>현재 운영 여부&nbsp;&nbsp;</strong><span style="color: #0b75ad;font-weight:bold;">${manageSttus}</span></p>
  <p><img src="./img/map_icon.svg" ><strong>오시는 길&nbsp;&nbsp;</strong>${direction}</p>
  <p><img src="./img/reservation_icon.png" ><strong>예약 방법&nbsp;&nbsp;</strong><span style="color: #0b75ad;font-weight:bold;">${resveCl}</span></p>
  <p><img src="./img/cook_icon.svg" ><strong>내부 시설&nbsp;&nbsp;</strong>${caravInnerFclty}</p>
  <p><img src="./img/inner_icon.png" ><strong>기타 시설&nbsp;&nbsp;</strong>${sbrsEtc}</p>
  <p><img src="./img/dog_icon.png" ><strong>반려동물 동반 가능 여부&nbsp;&nbsp;</strong><span style="color: #2AC182;font-weight:bold;">${animalCmgCl}</span></p>
`;
};

// 캠핑장 검색
const searchCamps = (query, map) => {
  const $campItem = document.querySelectorAll(".campItem");
  $campItem.forEach((item) => {
    if (item.innerHTML.toLowerCase().includes(query)) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
};

// geolocation 사용자 현재 위치

const getUserLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        initMap(lat, lng);
      },
      (error) => {
        console.error(
          "geolocation을 사용할 수 없어요... 에러 코드: " + error.code
        );
        initMap(defaultLat, defaultLng);
      }
    );
  } else {
    console.error("geolocation을 사용할 수 없어요...");
    initMap(defaultLat, defaultLng);
  }
};
// 네이버 지도처럼 토글버튼 사용해 사이드바 작동
const toggleSidebarFn = (event) => {
  $con.classList.toggle("collapsed");
  $map.classList.toggle("collapsed");

  // 아이콘 변경
  const icon = event.currentTarget.querySelector("i");
  if ($con.classList.contains("collapsed")) {
    icon.classList.remove("fa-arrow-left");
    icon.classList.add("fa-arrow-right");
    event.currentTarget.style.left = "10px";
  } else {
    icon.classList.remove("fa-arrow-right");
    icon.classList.add("fa-arrow-left");
    if (window.innerWidth <= 768) {
      event.currentTarget.style.left = "calc(100% - 30px)";
    } else {
      event.currentTarget.style.left = "500px";
    }
  }
};
$toggleSidebar.addEventListener("click", (event) => {
  toggleSidebarFn(event);
});

getUserLocation();
