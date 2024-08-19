const $con = document.getElementById("Con");
const $map = document.getElementById("map");
const $logo = document.getElementById("logo");
const $campList = document.getElementById("campList");

const $campDetails = document.getElementById("campDetails");
const $searchInput = document.getElementById("searchInput");
const $campTitle = document.getElementById("campTitle");
const $toggleSidebar = document.getElementById("toggleSidebar");

const DATA_KEY = config.DATA_KEY;
const KAKAO_KEY = config.KAKAO_KEY;
// debounce 처리
const debounce = (func, timeout = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
};

// 사용자 위치를 받지 못했을 때 기본 위치
const defaultLat = 36.5;
const defaultLng = 127.5;
let map, clusterer;

// 카카오맵 로드
const loadKakaoMap = () => {
  return new Promise((resolve, reject) => {
    const mapScript = document.createElement("script");

    mapScript.async = true;
    mapScript.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=clusterer&autoload=false`;

    document.head.appendChild(mapScript);

    mapScript.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          resolve();
        });
      } else {
        reject(new Error("카카오맵 API 로드 실패"));
      }
    };

    mapScript.onerror = reject;
  });
};

// 클러스터러 및 맵 초기화
const initMap = (lat, lng) => {
  const mapOption = {
    center: new kakao.maps.LatLng(lat, lng),
    level: 9,
    maxLevel: 12,
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

  const debouncedLoadMarkers = debounce(() => {
    const center = map.getCenter();
    const ne = map.getBounds().getNorthEast();
    const radius = calculateDistance(center, ne);

    $campTitle.textContent = "모든 캠핑장";

    loadMarkers(center.getLat(), center.getLng(), radius);
  }, 300);

  kakao.maps.event.addListener(map, "bounds_changed", debouncedLoadMarkers);

  loadMarkers(lat, lng, 10000); // 처음 반경 10km로 설정
};

// 두 지점 거리 계산
const calculateDistance = (point1, point2) => {
  const line = new kakao.maps.Polyline({
    path: [point1, point2],
  });
  return line.getLength();
};
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

// 로고 클릭 시 새로고침
$logo.addEventListener("click", () => {
  window.location.reload();
});

// 마커 생성 함수
const createMarkers = (data) => {
  const markers = [];

  for (let i = 0; i < data.length; i++) {
    const lat = parseFloat(data[i].mapY);
    const lng = parseFloat(data[i].mapX);

    const markerPosition = new kakao.maps.LatLng(lat, lng);

    const imageSrc = "/GOCAMPING/img/tent.svg";
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

// 초기 화면 사용자 위치 기반 마커
const loadMarkers = async (lat, lng, radius) => {
  const url = `https://apis.data.go.kr/B551011/GoCamping/locationBasedList?numOfRows=500&pageNo=1&MobileOS=ETC&MobileApp=AppTest&serviceKey=${DATA_KEY}&mapX=${lng}&mapY=${lat}&radius=${radius}&_type=json`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const data = json.response.body.items.item;

    $campList.innerHTML = "";

    if (!data || data.length === 0) {
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

// 캠핑장 리스트에 항목 추가
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
    $campDetails.style.display = "block";

    CampDetails(campData);
  });
  $campList.appendChild(listItem);
};

// 클릭한 캠핑장 상세정보
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
    <div class="details-header">
    <h2>${facltNm}</h2>
    <button id="backBtn"> 리스트 보기</button>
  </div>
  <div class="detailCon">
    <img src="${firstImageUrl}" />
    <div class="intro">
      <span>${addr1}</span>
      <span>${intro}</span>
    </div>
  </div>
  <p><img src="/GOCAMPING/img/home_icon.png" ><strong>홈페이지&nbsp;&nbsp;</strong><span>${homepage}</span></p>
  <p><img src="/GOCAMPING/img/clock_icon.png" ><strong>현재 운영 여부&nbsp;&nbsp;</strong><span>${manageSttus}</span></p>
  <p><img src="/GOCAMPING/img/map_icon.svg" ><strong>오시는 길&nbsp;&nbsp;</strong>${direction}</p>
  <p><img src="/GOCAMPING/img/reservation_icon.png" ><strong>예약 방법&nbsp;&nbsp;</strong><span>${resveCl}</span></p>
  <p><img src="/GOCAMPING/img/cook_icon.svg" ><strong>내부 시설&nbsp;&nbsp;</strong>${caravInnerFclty}</p>
  <p><img src="/GOCAMPING/img/inner_icon.png" ><strong>기타 시설&nbsp;&nbsp;</strong>${sbrsEtc}</p>
  <p><img src="/GOCAMPING/img/dog_icon.png" ><strong>반려동물 동반 가능 여부&nbsp;&nbsp;</strong><span>${animalCmgCl}</span></p>
  `;

  document.getElementById("backBtn").addEventListener("click", () => {
    $campDetails.style.display = "none";
    $campList.style.display = "block";
    $campTitle.style.display = "block";
  });
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

// 사용자 위치 가져오기
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

// 사이드바 토글 기능
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

loadKakaoMap()
  .then((kakao) => {
    getUserLocation(kakao);
  })
  .catch((error) => {
    console.error("카카오맵 API 로드 중 오류가 발생했습니다:", error);
  });
