#pragma once
void controlBridgeStart();
void controlBridgePoll();
void controlBridgeMenu();
void controlBridgeGNSS(double lat,double lon,int satellites,double hdop);
bool controlBridgePhone(double &lat,double &lon,double &accuracy);
