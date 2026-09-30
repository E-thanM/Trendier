"""
Single source of truth for the AI-glasses temple PCB.

Every part, every pin->net assignment and every placement lives here.
gen_sch.py builds the KiCad schematic from it, gen_pcb.py builds the board,
and check_design.py verifies schematic <-> PCB <-> this file agree.

Board coordinate system (mm, before OFFSET is added):
  x = 0 is the FRONT edge (hinge end, ESP32 antenna), x grows toward the ear.
  y = 0 is the TOP edge of the temple arm (straight along the whole board).

Dimensions are set from adult head / ear anthropometry (see docs/DESIGN.md):
  * the board starts ~6 mm behind the hinge (hinge barrel + housing wall);
  * hinge -> ear bend ("length to bend") is ~95-105 mm for adults, so the
    thin strip ends ~100 mm from the hinge, right where the temple starts to
    drop behind the ear;
  * the strip over the ear root is kept thin (6.5 mm) so the arm can be
    ~8-9 mm tall where it rests in the supra-auricular groove;
  * the rear pad hangs down behind the auricle over the mastoid process,
    a good bone-conduction site, and holds the amp + transducer.

  Front section   x   0 .. 48   y 0 .. 22    (ESP32, charger, camera FPC, mic)
  Taper           x  48 .. 62   bottom edge rises 22 -> 6.5, top straight
  Strip           x  62 .. 94   y 0 .. 6.5   (over the ear root)
  Rear pad        x  94 .. 116  y 0 .. 22    (behind the ear, on the mastoid)
"""

OFFSET = (50.0, 50.0)          # where local (0,0) lands on the KiCad page

# ---------------------------------------------------------------- outline
FRONT_W, FRONT_H = 48.0, 22.0
TAPER1 = 14.0
STRIP_L, STRIP_W = 32.0, 6.5
REAR_L = 22.0
HINGE_TO_BOARD = 6.0          # board front edge behind the hinge axis
CORNER_R = 2.0
BOARD_THICKNESS = 1.0

STRIP_X0 = FRONT_W + TAPER1                 # 62
STRIP_X1 = STRIP_X0 + STRIP_L               # 94
REAR_X0 = STRIP_X1                          # 94
REAR_X1 = REAR_X0 + REAR_L                  # 116
MID_Y = FRONT_H / 2                         # 11 (front/rear centre line)
STRIP_Y0, STRIP_Y1 = 0.0, STRIP_W           # strip hugs the top edge
STRIP_MID = STRIP_W / 2

# VSYS trunk down the strip on In2 (front via ... rear via) and its pour
VSYS_TRUNK_VIAS = [(STRIP_X0 + 1.0, STRIP_MID), (REAR_X0 + 1.5, STRIP_MID)]
VSYS_POUR_X = (STRIP_X0 - 0.5, REAR_X0 + 2.5)

ANTENNA_KEEPOUT_X = 6.8     # module antenna ends at x=6.05; keep all copper out

# ---------------------------------------------------------------- libraries
R0402 = "Resistor_SMD:R_0402_1005Metric"
C0402 = "Capacitor_SMD:C_0402_1005Metric"
C0603 = "Capacitor_SMD:C_0603_1608Metric"
C0805 = "Capacitor_SMD:C_0805_2012Metric"
LED0603 = "LED_SMD:LED_0603_1608Metric"
SOT23 = "Package_TO_SOT_SMD:SOT-23"
SOT235 = "Package_TO_SOT_SMD:SOT-23-5"
SOT236 = "Package_TO_SOT_SMD:SOT-23-6"

PARTS = []


def part(ref, sym, fp, value, pins, pos, mpn="", block="", desc=""):
    """pos = (x, y, rotation_deg, 'F'|'B')."""
    PARTS.append(dict(ref=ref, sym=sym, fp=fp, value=value, pins=pins,
                      pos=pos, mpn=mpn, block=block, desc=desc))


def R(ref, value, a, b, pos, block, mpn=""):
    part(ref, "Device:R", R0402, value, {"1": a, "2": b}, pos, mpn, block)


def C(ref, value, a, b, pos, block, fp=C0402, mpn=""):
    part(ref, "Device:C", fp, value, {"1": a, "2": b}, pos, mpn, block)


NC = None   # explicit "no connect"

# ======================================================= USB-C + protection
part("J1", "Connector:USB_C_Receptacle_USB2.0_16P",
     "Connector_USB:USB_C_Receptacle_GCT_USB4105-xx-A_16P_TopMnt_Horizontal",
     "USB-C", {
         "A1": "GND", "A12": "GND", "B1": "GND", "B12": "GND",
         "A4": "VBUS", "A9": "VBUS", "B4": "VBUS", "B9": "VBUS",
         "A5": "CC1", "B5": "CC2",
         "A6": "USB_DP", "B6": "USB_DP", "A7": "USB_DM", "B7": "USB_DM",
         "A8": NC, "B8": NC, "S1": "GND"},
     (42.0, 18.32, 0, "F"), "GCT USB4105-GF-A", "power",
     "USB-C 2.0 receptacle, charging + native USB programming")
R("R1", "5.1k", "CC1", "GND", (42.6, 9.0, 90, "F"), "power")
R("R2", "5.1k", "CC2", "GND", (44.2, 9.0, 90, "F"), "power")
part("U8", "Power_Protection:USBLC6-2SC6", SOT236, "USBLC6-2SC6",
     {"1": "USB_DP", "6": "USB_DP", "3": "USB_DM", "4": "USB_DM",
      "2": "GND", "5": "VBUS"},
     (34.4, 16.4, 0, "F"), "STMicro USBLC6-2SC6", "power", "USB ESD protection")
C("C1", "4.7uF", "VBUS", "GND", (44.0, 12.0, 0, "F"), "power", C0603)

# ======================================================= Li-Po charger + power path
part("U2", "Battery_Management:MCP73831-2-OT", SOT235, "MCP73831-2-OT",
     {"1": "CHG_STAT", "2": "GND", "3": "VBAT", "4": "VBUS", "5": "CHG_PROG"},
     (45.5, 9.4, 0, "B"), "Microchip MCP73831T-2ACI/OT", "power",
     "Single-cell Li-Po charger, 196 mA (R4)")
R("R4", "5.1k", "CHG_PROG", "GND", (45.5, 12.4, 0, "B"), "power")
part("D2", "Device:LED", LED0603, "RED",
     {"1": "CHG_LED_K", "2": "VBUS"}, (40.0, 11.0, 0, "B"), "", "power",
     "Charging indicator")
R("R5", "1k", "CHG_LED_K", "CHG_STAT", (40.0, 9.2, 0, "B"), "power")
C("C2", "4.7uF", "VBAT", "GND", (49.2, 9.4, 90, "B"), "power", C0603)
part("J3", "Connector_Generic_MountingPin:Conn_01x02_MountingPin",
     "Connector_JST:JST_SH_SM02B-SRSS-TB_1x02-1MP_P1.00mm_Horizontal",
     "LiPo 1S", {"1": "VBAT", "2": "GND", "MP": NC},
     (33.5, 18.8, 0, "B"), "JST SM02B-SRSS-TB", "power",
     "Battery connector (JST-SH 1 mm). Pin1 = +, Pin2 = -")
part("D1", "Device:D_Schottky", "Diode_SMD:D_SOD-323", "B5819WS",
     {"1": "VSYS", "2": "VBUS"}, (41.5, 1.8, 0, "B"), "B5819WS", "power",
     "USB -> system power path")
part("Q1", "Device:Q_PMOS_GSD", SOT23, "DMG3415U",
     {"1": "VBUS", "2": "VSYS", "3": "VBAT"}, (41.5, 5.4, 0, "B"),
     "Diodes DMG3415U-7", "power",
     "Battery -> system ideal-diode switch (off when USB present)")
R("R3", "100k", "VBUS", "GND", (44.9, 4.6, 90, "B"), "power")

# ======================================================= Regulators
part("U3", "Regulator_Linear:AP2112K-3.3", SOT235, "AP2112K-3.3",
     {"1": "VSYS", "2": "GND", "3": "VSYS", "4": NC, "5": "+3V3"},
     (34.0, 3.0, 0, "B"), "Diodes AP2112K-3.3TRG1", "power",
     "3.3 V / 600 mA main LDO")
C("C3", "10uF", "VSYS", "GND", (38.0, 3.0, 90, "B"), "power", C0603)
C("C4", "10uF", "+3V3", "GND", (30.2, 3.0, 90, "B"), "power", C0603)
part("U4", "AI_Glasses:TLV70028_SOT23-5", SOT235, "TLV70028DDCR",
     {"1": "+3V3", "2": "GND", "3": "+3V3", "4": NC, "5": "+2V8_CAM"},
     (50.0, 2.4, 0, "F"), "TI TLV70028DDCR", "camera",
     "Camera AVDD 2.8 V LDO")
C("C5", "1uF", "+3V3", "GND", (53.9, 1.6, 0, "F"), "camera")
C("C6", "1uF", "+2V8_CAM", "GND", (53.9, 3.1, 0, "F"), "camera")
part("U5", "Regulator_Linear:TLV70012_SOT23-5", SOT235, "TLV70012DDCR",
     {"1": "+3V3", "2": "GND", "3": "+3V3", "4": NC, "5": "+1V2_CAM"},
     (50.0, 6.0, 0, "F"), "TI TLV70012DDCR", "camera",
     "Camera DVDD 1.2 V LDO")
C("C7", "1uF", "+3V3", "GND", (53.9, 5.2, 0, "F"), "camera")
C("C8", "1uF", "+1V2_CAM", "GND", (53.9, 6.7, 0, "F"), "camera")

# ======================================================= ESP32-S3 module
ESP = {
    "1": "GND", "40": "GND", "41": "GND", "2": "+3V3", "3": "EN",
    "4": "VBAT_SENSE",          # IO4  ADC1_CH3
    "5": "MIC_SCK",             # IO5  I2S0 BCLK
    "6": "MIC_WS",              # IO6  I2S0 WS
    "7": "MIC_SD",              # IO7  I2S0 DIN
    "8": "AMP_BCLK",            # IO15 I2S1 BCLK
    "9": "AMP_LRCLK",           # IO16 I2S1 WS
    "10": "AMP_DIN",            # IO17 I2S1 DOUT
    "11": "AMP_SD",             # IO18 amp enable (high = on, left channel)
    "12": "LED_STATUS",         # IO8
    "13": "USB_DM",             # IO19
    "14": "USB_DP",             # IO20
    "15": NC,                   # IO3  (strapping, JTAG select) - unused
    "16": NC,                   # IO46 (strapping) - unused
    "17": "CAM_D0",             # IO9   Y2
    "18": "CAM_D1",             # IO10  Y3
    "19": "CAM_D2",             # IO11  Y4
    "20": "CAM_D3",             # IO12  Y5
    "21": "CAM_D4",             # IO13  Y6
    "22": "CAM_D5",             # IO14  Y7
    "23": "CAM_D6",             # IO21  Y8
    "24": "CAM_D7",             # IO47  Y9
    "25": "CAM_PCLK",           # IO48
    "26": NC,                   # IO45 (strapping, VDD_SPI) - unused
    "27": "BOOT",               # IO0
    "28": NC, "29": NC, "30": NC,   # IO35-37: octal PSRAM on N16R8, never use
    "31": "CAM_VSYNC",          # IO38
    "32": "CAM_HREF",           # IO39
    "33": "CAM_XCLK",           # IO40
    "34": "CAM_SIOD",           # IO41
    "35": "CAM_SIOC",           # IO42
    "36": "UART_RX",            # RXD0 / IO44
    "37": "UART_TX",            # TXD0 / IO43
    "38": "CAM_PWDN",           # IO2
    "39": "CAM_RESET",          # IO1
}
part("U1", "RF_Module:ESP32-S3-WROOM-1", "RF_Module:ESP32-S3-WROOM-1",
     "ESP32-S3-WROOM-1-N16R8", ESP, (12.8, 11.0, 90, "F"),
     "Espressif ESP32-S3-WROOM-1-N16R8", "mcu",
     "Wi-Fi/BLE MCU, 16 MB flash, 8 MB octal PSRAM")
C("C12", "22uF", "+3V3", "GND", (9.0, 16.8, 90, "B"), "mcu", C0805)
C("C13", "100nF", "+3V3", "GND", (11.0, 17.2, 90, "B"), "mcu")
R("R6", "10k", "+3V3", "EN", (12.6, 17.2, 90, "B"), "mcu")
C("C14", "1uF", "EN", "GND", (14.2, 17.2, 90, "B"), "mcu")
R("R7", "10k", "+3V3", "BOOT", (23.8, 5.6, 90, "B"), "mcu")
part("SW1", "Switch:SW_Push", "Button_Switch_SMD:SW_SPST_B3U-1000P", "BOOT",
     {"1": "BOOT", "2": "GND"}, (20.0, 3.0, 0, "B"), "Omron B3U-1000P", "mcu",
     "Boot / user button (IO0)")
part("SW2", "Switch:SW_Push", "Button_Switch_SMD:SW_SPST_B3U-1000P", "RESET",
     {"1": "EN", "2": "GND"}, (13.5, 3.0, 0, "B"), "Omron B3U-1000P", "mcu",
     "Reset button (EN)")
R("R9", "1M", "VBAT", "VBAT_SENSE", (16.2, 15.8, 0, "B"), "mcu")
R("R10", "1M", "VBAT_SENSE", "GND", (16.2, 17.2, 0, "B"), "mcu")
C("C15", "100nF", "VBAT_SENSE", "GND", (16.2, 18.6, 0, "B"), "mcu")
part("D3", "Device:LED", LED0603, "GREEN",
     {"1": "GND", "2": "LED_STATUS_A"}, (20.2, 18.6, 0, "B"), "", "mcu",
     "Status LED")
R("R8", "1k", "LED_STATUS", "LED_STATUS_A", (20.2, 16.9, 0, "B"), "mcu")
part("TP1", "Connector:TestPoint", "TestPoint:TestPoint_Pad_D1.0mm", "TX",
     {"1": "UART_TX"}, (8.2, 5.2, 0, "B"), "", "mcu", "UART0 TX test pad")
part("TP2", "Connector:TestPoint", "TestPoint:TestPoint_Pad_D1.0mm", "RX",
     {"1": "UART_RX"}, (8.2, 7.6, 0, "B"), "", "mcu", "UART0 RX test pad")
part("TP3", "Connector:TestPoint", "TestPoint:TestPoint_Pad_D1.0mm", "GND",
     {"1": "GND"}, (8.2, 10.0, 0, "B"), "", "mcu", "GND test pad")
part("TP4", "Connector:TestPoint", "TestPoint:TestPoint_Pad_D1.0mm", "3V3",
     {"1": "+3V3"}, (8.2, 12.4, 0, "B"), "", "mcu", "3V3 test pad")

# ======================================================= Camera (DVP, 24-pin FPC)
# Standard OV2640/OV5640 24-pin 0.5 mm FPC pin-out (ESP32-CAM / ESP-EYE style).
CAM = {
    "1": NC, "2": "GND", "3": "CAM_SIOD", "4": "+2V8_CAM", "5": "CAM_SIOC",
    "6": "CAM_RESET", "7": "CAM_VSYNC", "8": "CAM_PWDN", "9": "CAM_HREF",
    "10": "+1V2_CAM", "11": "+3V3", "12": "CAM_D7", "13": "CAM_XCLK",
    "14": "CAM_D6", "15": "GND", "16": "CAM_D5", "17": "CAM_PCLK",
    "18": "CAM_D4", "19": "CAM_D0", "20": "CAM_D3", "21": "CAM_D1",
    "22": "CAM_D2", "23": NC, "24": NC, "MP": NC,
}
part("J2", "Connector_Generic_MountingPin:Conn_01x24_MountingPin",
     "Connector_FFC-FPC:Hirose_FH12-24S-0.5SH_1x24-1MP_P0.50mm_Horizontal",
     "CAMERA DVP", CAM, (37.0, 4.45, 180, "F"), "Hirose FH12-24S-0.5SH(55)",
     "camera", "24-pin 0.5 mm FPC for OV2640 / OV5640 DVP camera")
R("R11", "4.7k", "+3V3", "CAM_SIOD", (38.0, 8.6, 0, "F"), "camera")
R("R12", "4.7k", "+3V3", "CAM_SIOC", (38.0, 10.0, 0, "F"), "camera")
R("R13", "10k", "+3V3", "CAM_RESET", (38.0, 11.4, 0, "F"), "camera")
R("R14", "10k", "CAM_PWDN", "GND", (38.0, 12.8, 0, "F"), "camera")
C("C9", "100nF", "+2V8_CAM", "GND", (40.4, 8.6, 0, "F"), "camera")
C("C10", "100nF", "+1V2_CAM", "GND", (40.4, 10.0, 0, "F"), "camera")
C("C11", "100nF", "+3V3", "GND", (40.4, 11.4, 0, "F"), "camera")

# ======================================================= Microphone
part("U6", "Sensor_Audio:ICS-43434",
     "Sensor_Audio:InvenSense_ICS-43434-6_3.5x2.65mm", "ICS-43434",
     {"1": "MIC_WS", "2": "GND", "3": "GND", "4": "MIC_SCK", "5": "+3V3",
      "6": "MIC_SD"}, (29.6, 16.6, 0, "F"), "TDK InvenSense ICS-43434", "audio",
     "I2S MEMS microphone, bottom port (hole through PCB)")
C("C16", "100nF", "+3V3", "GND", (29.6, 20.3, 0, "F"), "audio")
R("R15", "100k", "MIC_SD", "GND", (32.2, 20.3, 0, "F"), "audio")

# ======================================================= Rear: amp + transducer
part("U7", "Audio:MAX98357A",
     "Package_DFN_QFN:TQFN-16-1EP_3x3mm_P0.5mm_EP1.23x1.23mm_ThermalVias",
     "MAX98357A", {
         "1": "AMP_DIN", "2": "GND", "3": "GND", "4": "AMP_SD", "5": NC,
         "6": NC, "7": "VSYS", "8": "VSYS", "9": "SPK_P", "10": "SPK_N",
         "11": "GND", "12": NC, "13": NC, "14": "AMP_LRCLK", "15": "GND",
         "16": "AMP_BCLK", "17": "GND"},
     (REAR_X0 + 6.0, 5.0, 0, "F"), "Analog Devices MAX98357AETE+T", "audio",
     "3.2 W I2S class-D amplifier, gain 12 dB (GAIN_SLOT to GND)")
C("C17", "22uF", "VSYS", "GND", (REAR_X0 + 5.2, 9.9, 0, "F"), "audio", C0805)
C("C18", "100nF", "VSYS", "GND", (REAR_X0 + 8.4, 9.9, 0, "F"), "audio")
part("LS1", "Device:Speaker", "AI_Glasses:BoneTransducer_SolderPads",
     "BONE TRANSDUCER", {"1": "SPK_P", "2": "SPK_N"}, (REAR_X0 + 14.5, 12.0, 0, "F"),
     "8 ohm bone-conduction exciter (e.g. 13x13 mm, 1 W)", "audio",
     "Bone conduction transducer solder pads")

# ---------------------------------------------------------------- net classes
NETCLASSES = {
    # name: (track, clearance, via_d, via_drill, nets)
    "Default": (0.15, 0.15, 0.5, 0.25, None),
    # 0.3 mm keeps power routable into 0.5 mm-pitch QFN/FPC pads; the
    # long VSYS run down the strip is reinforced by an In2 copper pour.
    "Power": (0.3, 0.15, 0.5, 0.25, ["VBUS", "VBAT", "VSYS", "+3V3"]),
    "Ground": (0.3, 0.15, 0.5, 0.25, ["GND"]),
    "CamPower": (0.25, 0.15, 0.5, 0.25, ["+2V8_CAM", "+1V2_CAM"]),
    "Speaker": (0.3, 0.15, 0.5, 0.25, ["SPK_P", "SPK_N"]),
}

POWER_FLAG_NETS = ["VBUS", "VBAT", "GND", "VSYS"]


def nets():
    s = set()
    for p in PARTS:
        s |= {n for n in p["pins"].values() if n}
    return sorted(s)


def by_ref():
    return {p["ref"]: p for p in PARTS}


def uuid_for(tag):
    """Deterministic UUIDs so schematic symbols and PCB footprints stay linked."""
    import uuid
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "ai-glasses/" + tag))


ROOT_UUID = uuid_for("root-sheet")
