import unittest
from evidence_engine import analyze

AUTH = {'kind':'authentication','auth':{'success_fields':['success','lab_authenticated'],'identity_fields':['users'],'confirmation_mode':'response'}}
DENIED = {'status':401,'flags':{'success':False,'lab_authenticated':False},'identity_fields_present':[]}
AUTHORIZED = {'status':200,'flags':{'success':True,'lab_authenticated':True},'identity_fields_present':['users']}

class TestEvidence(unittest.TestCase):
    def test_sqli_confirmed(self):
        r=analyze({'attackType':'SQLI','contract':AUTH,'request':{'field':'username'},'baseline':DENIED,'falseCondition':DENIED,'testResponse':AUTHORIZED})
        self.assertEqual(r['outcome'],'confirmed')
    def test_sqli_no_bypass(self):
        r=analyze({'attackType':'SQLI','contract':AUTH,'request':{'field':'username'},'baseline':DENIED,'falseCondition':DENIED,'testResponse':DENIED})
        self.assertEqual(r['outcome'],'not_confirmed')
    def test_sqli_200_not_proof(self):
        r=analyze({'attackType':'SQLI','contract':AUTH,'request':{'field':'username'},'baseline':DENIED,'falseCondition':DENIED,'testResponse':{'status':200,'flags':{},'identity_fields_present':[]}})
        self.assertEqual(r['outcome'],'inconclusive')
    def test_xss_reflection_only(self):
        r=analyze({'attackType':'XSS','request':{'field':'search'},'baseline':{'status':200},'testResponse':{'status':200,'payload_reflected':True}})
        self.assertEqual(r['outcome'],'suspected')
    def test_xss_browser_proof(self):
        r=analyze({'attackType':'XSS','request':{'field':'search'},'baseline':{'status':200},'testResponse':{'status':200},'browser':{'checked':True,'executed':True}})
        self.assertEqual(r['outcome'],'confirmed')
    def test_rate_limit(self):
        r=analyze({'attackType':'SQLI','contract':AUTH,'baseline':DENIED,'falseCondition':DENIED,'testResponse':{'status':429}})
        self.assertEqual(r['outcome'],'inconclusive')
    
    def test_xss_without_browser_confirmation(self):
        data = {
            "attackType": "XSS",
            "request": {
                "field": "search"
            },
            "baseline": {
                "status": 200
            },
            "testResponse": {
                "status": 200,
                "payload_reflected": True
            },
            "browser": {
                "checked": False,
                "executed": True
            }
        }

        result = analyze(data)

        self.assertEqual(
            result["outcome"],
            "inconclusive"
        )

if __name__=='__main__': unittest.main()