import os
import time
from datetime import datetime, timedelta
from urllib.parse import quote
from fastapi import HTTPException
from dotenv import load_dotenv
import requests
from curl_cffi import requests as creq
import logging

from sqlalchemy.testing.provision import follower_url_from_main

from models import Purchase
from models.open_food_facts import OpenFoodFacts

logger = logging.getLogger(__name__)

load_dotenv()

# ---------------------------------------------------------------------------
# Carrefour HTTP client
# ---------------------------------------------------------------------------

class CarrefourClient:
    LOGIN_URL = os.getenv("LOGIN_URL", "")
    GET_JWT_URL = os.getenv("GET_JWT_URL", "")
    PURCHASE_LIST_URL = os.getenv("PURCHASE_LIST_URL", "")
    PURCHASE_DETAIL_URL = os.getenv("PURCHASE_DETAIL_URL", "")
    SEARCH_URL = os.getenv("SEARCH_URL", "")
    API_KEY = os.getenv("API_KEY", "")

    FROM_DATE = "2026-01-01T00:00:00.000Z"

    def __init__(self):
        self.email = os.getenv("CARREFOUR_EMAIL", "")
        self.password = os.getenv("CARREFOUR_PASSWORD", "")
        self.api_key = self.API_KEY
        self.id_token = self.authenticate()

    def login(self) -> dict:
        payload = (
            f"loginID={quote(self.email)}&"
            f"password={quote(self.password)}&"
            "sessionExpiration=-1&targetEnv=jssdk&"
            "include=profile%2Cdata%2Cemails%2Csubscriptions%2Cpreferences%2C&"
            "includeUserInfo=true&loginMode=standard&lang=es&"
            f"APIKey={self.api_key}&source=showScreenSet&sdk=js_latest&"
            "authMode=cookie&pageURL=https%3A%2F%2Fwww.carrefour.es%2Faccess&"
            "sdkBuild=18585&format=json"
        )
        response = requests.post(
            self.LOGIN_URL,
            data=payload,
            headers={
                "content-type": "application/x-www-form-urlencoded",
                "Cookie": "_ga=GA1.1.1337231976.1762887911; OneTrustGroupsConsent-ES=,C0022,C0166,C0096,C0021,C0007,C0052,C0002,C0003,C0001,C0063,C0174,C0081,C0054,C0051,C0023,C0025,C0038,C0041,C0040,C0057,C0082,C0135,C0141,C0180,C0084,C0032,C0039,C0004,V2STACK42,; _cs_c=1; _pin_unauth=dWlkPU1UTmxNRFZqWVRjdFlqRXlNeTAwTUdGbUxUbGtOREV0T0dZNU56Y3hPVEF6WW1ZMg; zpstorage_NDJiMWIyMDItYmUxYS00MDM0LWEyZDUtNzczOTVmMTIzY2Ezzicarrefour.es=IjZmMzU2ZTA3LTJmMTgtNDNiNi04ODc3LTcxOGU3OTlhMzNjZCI%3D; lantern=870cc14a-3b53-4359-8552-564029522442; _tt_enable_cookie=1; _ttp=01KJAYX15YT6YA8VBRQ7NCMQWA_.tt.1; _clck=17nomxj%5E2%5Eg3v%5E1%5E2247; gmid=gmid.ver4.AtLtCj0_2Q.UbHNZ9YPw-TS4FbtZTlWiMe4WjI2qBvfWF3p0smZWcXCDBOf7TEWSu0cfBDnUTjE.RPBAsg3ehFZ3jfziw_F2gAiIBmkRRXOjploV_DPp7UEh5k_nzC91g-TgNsMZ7ZhfgW7PQbUsbSiSVB3xuTIALA.sc3; ucid=JZZXtGUY5qvQ_kJHA7izjQ; hasGmid=ver4; __cf_bm=AoKIaVXCDMwX99xkOI0NVTQRJLSCOqqF7XuoUXiqC1M-1772042338-1.0.1.1-W9RTkLNRprEzPILY1xYTqNuNF7yPTOZYWk1lCx4GFTFj39modPj59Ej1De5a.QVXD2uWrPzo.ZlZvZnAp_oMZnR3JVudFgVp5dncct4WFsw; gig_bootstrap_3_Ns3U5-wXeiSQL-vZtu1Fd2DpWBsEdB78mYs2dn0_kyFFwwSJAZZd1EHUm9kodfND=ss-mya-p3_ver4; XSRF-TOKEN=4b82641e-bdcd-460d-aff5-222469599820; _cs_cvars=%7B%222%22%3A%5B%22userLoginStatus%22%2C%22unlogged%22%5D%2C%228%22%3A%5B%22userSalePoint%22%2C%22004015%22%5D%7D; _cs_id=34160f86-f1fc-a641-9dcf-287abeff3548.1762887914.2.1772042805.1772041962.1761120188.1797051914350.1.x; _cs_s=37.5.U.9.1772044605856; ABTastySession=mrasn=&lp=https%253A%252F%252Fwww.carrefour.es%252Fpreguntas-frecuentes%252Fmas-info%252F; ABTasty=uid=qn6p960yyt4j01e3&fst=1762887918008&pst=1762887918008&cst=1772041962386&ns=2&pvt=26&pvis=16&th=1588101.1980134.1.1.1.1.1772042793389.1772042793389.0.2; _clsk=1jst911%5E1772042806371%5E20%5E0%5En.clarity.ms%2Fcollect; _uetsid=c8ab7560127211f19be43d20ab533b70; _uetvid=58d771d0bf3111f0aa709f66a414a566; dtm_token_sc=AQAGxdfesmLq5AFAIO2nAQBC2AABAQCdlO-GdQEBAJ2U-msh; _gcl_au=1.1.1427737806.1772041962.405904392.1772042254.1772042814; ttcsid_C86HHLPG5FFMORB6TG70=1772041962687::-rWxUSJh7Q8lJBih3s4X.1.1772042821258.1; ttcsid=1772041962687::bymDTX0EVhrBzG-8wW79.1.1772042821258.0; _ga_KPXW54NX57=GS2.1.s1772041962$o2$g1$t1772042821$j60$l0$h0"
            },
        )
        response.raise_for_status()
        return response.json()

    def get_jwt(self, login_token: str) -> dict:
        payload = (
            "fields=data.GR%2Cprofile.email%2Cdata.DQ%2Cdata.acceptedCustomerPolicies%2Cdata.ID_ATG&"
            "expiration=1800&"
            f"APIKey={self.api_key}&sdk=js_latest&"
            f"login_token={login_token}&authMode=cookie&"
            "pageURL=https%3A%2F%2Fwww.carrefour.es%2Faccess&sdkBuild=18585&format=json"
        )
        response = requests.post(
            self.GET_JWT_URL,
            data=payload,
            headers={
                "content-type": "application/x-www-form-urlencoded",
                "Cookie": "_ga=GA1.1.1337231976.1762887911; OneTrustGroupsConsent-ES=,C0022,C0166,C0096,C0021,C0007,C0052,C0002,C0003,C0001,C0063,C0174,C0081,C0054,C0051,C0023,C0025,C0038,C0041,C0040,C0057,C0082,C0135,C0141,C0180,C0084,C0032,C0039,C0004,V2STACK42,; _cs_c=1; _pin_unauth=dWlkPU1UTmxNRFZqWVRjdFlqRXlNeTAwTUdGbUxUbGtOREV0T0dZNU56Y3hPVEF6WW1ZMg; zpstorage_NDJiMWIyMDItYmUxYS00MDM0LWEyZDUtNzczOTVmMTIzY2Ezzicarrefour.es=IjZmMzU2ZTA3LTJmMTgtNDNiNi04ODc3LTcxOGU3OTlhMzNjZCI%3D; lantern=870cc14a-3b53-4359-8552-564029522442; _tt_enable_cookie=1; _ttp=01KJAYX15YT6YA8VBRQ7NCMQWA_.tt.1; _clck=17nomxj%5E2%5Eg3v%5E1%5E2247; gmid=gmid.ver4.AtLtCj0_2Q.UbHNZ9YPw-TS4FbtZTlWiMe4WjI2qBvfWF3p0smZWcXCDBOf7TEWSu0cfBDnUTjE.RPBAsg3ehFZ3jfziw_F2gAiIBmkRRXOjploV_DPp7UEh5k_nzC91g-TgNsMZ7ZhfgW7PQbUsbSiSVB3xuTIALA.sc3; ucid=JZZXtGUY5qvQ_kJHA7izjQ; hasGmid=ver4; gig_bootstrap_3_Ns3U5-wXeiSQL-vZtu1Fd2DpWBsEdB78mYs2dn0_kyFFwwSJAZZd1EHUm9kodfND=ss-mya-p3_ver4; __cf_bm=GNoyAXMB6_bn0WRYa1GXHKaf6kcS0mJhfpJNcDkH15U-1772043307-1.0.1.1-6p_ll3SuXcRNzq7LPgu9o6teuu2gwsm02l.03GrKIEx4p_8rIKFmLPkZTkfYEz6jFu0Q5RUdFScx.ehXS2In1RVbYL5_Y2r4dcOPqT4lttw; XSRF-TOKEN=f5d98bb4-c476-48fe-8ae4-66d1d03276eb; _cs_cvars=%7B%222%22%3A%5B%22userLoginStatus%22%2C%22unlogged%22%5D%2C%228%22%3A%5B%22userSalePoint%22%2C%22004015%22%5D%7D; _cs_id=34160f86-f1fc-a641-9dcf-287abeff3548.1762887914.2.1772044102.1772041962.1761120188.1797051914350.1.x; _cs_s=56.5.U.9.1772045902188; ABTastySession=mrasn=&lp=https%253A%252F%252Fwww.carrefour.es%252Fpreguntas-frecuentes%252Fmas-info%252F; ABTasty=uid=qn6p960yyt4j01e3&fst=1762887918008&pst=1762887918008&cst=1772041962386&ns=2&pvt=37&pvis=27&th=1588101.1980134.1.1.1.1.1772042793389.1772042793389.0.2; _uetsid=c8ab7560127211f19be43d20ab533b70; _uetvid=58d771d0bf3111f0aa709f66a414a566; _clsk=1jst911%5E1772044103067%5E34%5E0%5En.clarity.ms%2Fcollect; dtm_token_sc=AQAGxdfesmLq5AFAIO2nAQBC2AABAQCdlO-GdQEBAJ2XDjFS; _derived_epik=dj0yJnU9V3lSX1kwVTlyMTZFTmtfVU1YS2VkdDVSbExKQjQwWDYmbj1neTJ6alQ4THpvQ2U2Nk1CVHVIWEFBJm09MTAmdD1BQUFBQUdtZlAwcyZybT0xMCZydD1BQUFBQUdtZlAwcyZzcD0x; ttcsid_C86HHLPG5FFMORB6TG70=1772041962687::-rWxUSJh7Q8lJBih3s4X.1.1772044114927.1; ttcsid=1772041962687::bymDTX0EVhrBzG-8wW79.1.1772044114927.0; _ga_KPXW54NX57=GS2.1.s1772041962$o2$g1$t1772044114$j27$l0$h0; _gcl_au=1.1.1427737806.1772041962.405904392.1772042254.1772044114; glt_3_Ns3U5-wXeiSQL-vZtu1Fd2DpWBsEdB78mYs2dn0_kyFFwwSJAZZd1EHUm9kodfND=st2.s.AtLtIwK_OA.bVDXipavY6b-sNifEa_wr-7cnVzXCashRf0dyHLGLvm0h3FWOohtZX0CJZWL2cKk_7pmK3rn-II4qaJ4AjFKGSlslbDEMzmsOFU6GZFjglNjRQb6MnNdTQMgfnpclEOe.ccayqQ92aFi69eqkVPGl8WvoixMvutakPwkUUvDejGQliHY2oc4zxLVlHKtIyodgfFuuBwjp6fltsQcmYblzng.sc3",
            }
        )
        response.raise_for_status()
        return response.json()

    def authenticate(self) -> str:
        """Full login flow → returns id_token."""
        login_data = self.login()
        if login_data.get("statusCode", 200) != 200:
            raise HTTPException(status_code=401, detail=login_data.get("statusReason", "Login failed"))
        login_token = login_data["sessionInfo"]["login_token"]
        token_data = self.get_jwt(login_token)
        if "id_token" not in token_data:
            raise HTTPException(status_code=401, detail="Failed to obtain JWT token")
        return token_data["id_token"]

    def get_purchases(
        self,
        from_date: str = FROM_DATE,
        to_date: str = "2030-12-31T23:59:59.000Z",
        count: int = 10,
    ) -> dict:
        params = {
            "from": from_date,
            "to": to_date,
            "atgfOffset": "0",
            "atgnfOffset": "0",
            "currentAtgfOrders": "0",
            "currentAtgnfOrders": "0",
            "currentTickets": "0",
            "ticketOffset": "0",
            "count": str(count),
        }
        response = requests.get(
            self.PURCHASE_LIST_URL,
            headers=self._auth_headers(self.id_token),
            params=params,
        )
        response.raise_for_status()
        return response.json()

    def get_last_purchase(self, from_date=FROM_DATE) -> Purchase | None:
        purchases = self.get_purchases(count=1, from_date=from_date)
        purchase_list = purchases.get("purchases", [])
        if not purchase_list:
            return None
        purchase_id = purchase_list[0].get("purchaseId")
        if not purchase_id:
            raise HTTPException(status_code=404, detail="Could not extract ticket ID from purchases")
        return self.get_purchase(purchase_id)

    def get_purchase(self, purchase_id: str) -> Purchase:
        response = requests.get(
            f"{self.PURCHASE_DETAIL_URL}/{purchase_id}",
            headers=self._auth_headers(self.id_token),
        )
        response.raise_for_status()
        data = response.json()
        purchase = Purchase.from_api_data(data)
        score = 0
        count = 0
        for p in purchase.products:
            off_item = OpenFoodFacts().get_product(p.code)
            if off_item:
                score += off_item.total_score
                count += 1
        purchase.health_score = score / count
        return purchase

    def search_product(self, query: str, store: str = "004015", page: int = 1) -> list:
        params = {
            "internal": "true",
            "instance": "x-carrefour",
            "env": "https://www.carrefour.es",
            "scope": "desktop",
            "lang": "es",
            "session": "empathy",
            "store": store,
            "query": query,
            "page": str(page),
        }
        response = creq.get(self.SEARCH_URL, params=params, impersonate="chrome120")
        response.raise_for_status()
        return response.json().get("content", {}).get("docs", [])

    def find_last_purchase(self) -> Purchase | None:
        from_date = (datetime.now() - timedelta(minutes=5)).isoformat()
        for i in range(60):
            logger.info(f"Looking for ticket {i} - {from_date}")
            data = self.get_last_purchase(from_date=from_date)
            if data:
                return data
            time.sleep(5)
        return None

    @staticmethod
    def _auth_headers(id_token: str) -> dict:
        return {
            "authorization": f"bearer {id_token}",
            "content-type": "application/json",
            "requestorigin": "MYA",
        }

    @staticmethod
    async def save_last_ticket():
        from database import SessionLocal
        try:
            client = CarrefourClient()
            purchase = client.find_last_purchase()
            if not purchase:
                return None
            db = SessionLocal()
            try:
                db.add(purchase)
                db.commit()
                logger.info(f"Saved Carrefour ticket {purchase.ticket_id} with {len(purchase.products)} products")
            except Exception:
                db.rollback()
                raise
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Carrefour background fetch failed: {e}")