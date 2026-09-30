"""Writes the .kicad_pro, fp-lib-table and sym-lib-table for the project."""
import json
import os
import design as D

NAME = "ai_glasses"


def netclass(name, track, clr, via_d, via_dr):
    return {
        "name": name, "clearance": clr, "track_width": track,
        "via_diameter": via_d, "via_drill": via_dr,
        "microvia_diameter": 0.3, "microvia_drill": 0.1,
        "diff_pair_width": 0.2, "diff_pair_gap": 0.25, "diff_pair_via_gap": 0.25,
        "wire_width": 6, "bus_width": 12, "line_style": 0,
        "pcb_color": "rgba(0, 0, 0, 0.000)",
        "schematic_color": "rgba(0, 0, 0, 0.000)",
    }


def write(outdir):
    classes, patterns = [], []
    for name, (tw, clr, vd, vdr, nets) in D.NETCLASSES.items():
        classes.append(netclass(name, tw, clr, vd, vdr))
        for n in nets or []:
            patterns.append({"netclass": name, "pattern": n})
    pro = {
        "board": {
            "3dviewports": [],
            "design_settings": {
                "defaults": {
                    "board_outline_line_width": 0.1, "copper_line_width": 0.2,
                    "copper_text_size_h": 1.0, "copper_text_size_v": 1.0,
                    "copper_text_thickness": 0.15, "other_line_width": 0.1,
                    "silk_line_width": 0.15, "silk_text_size_h": 0.8,
                    "silk_text_size_v": 0.8, "silk_text_thickness": 0.15,
                    "zones": {"min_clearance": 0.2},
                },
                "diff_pair_dimensions": [],
                "drc_exclusions": [],
                "rule_severities": {
                    "lib_footprint_issues": "ignore",
                    "lib_footprint_mismatch": "ignore",
                    "silk_overlap": "warning",
                    "silk_over_copper": "warning",
                    "footprint_type_mismatch": "ignore",
                },
                "rules": {
                    "allow_blind_buried_vias": False, "allow_microvias": False,
                    "max_error": 0.005,
                    "min_clearance": 0.127,
                    "min_connection": 0.0,
                    "min_copper_edge_clearance": 0.25,
                    "min_hole_clearance": 0.15,
                    "min_hole_to_hole": 0.25,
                    "min_microvia_diameter": 0.2, "min_microvia_drill": 0.1,
                    "min_resolved_spokes": 1,
                    "min_silk_clearance": 0.0,
                    "min_text_height": 0.6, "min_text_thickness": 0.1,
                    "min_through_hole_diameter": 0.2,
                    "min_track_width": 0.127,
                    "min_via_annular_width": 0.1,
                    "min_via_diameter": 0.45,
                    "solder_mask_to_copper_clearance": 0.0,
                    "use_height_for_length_calcs": True,
                },
                "teardrop_options": [], "teardrop_parameters": [],
                "track_widths": [0.0, 0.15, 0.25, 0.3, 0.45, 0.6],
                "via_dimensions": [{"diameter": 0.0, "drill": 0.0},
                                   {"diameter": 0.5, "drill": 0.25}],
                "zones_allow_external_fillets": False,
            },
            "layer_presets": [], "viewports": [],
        },
        "boards": [], "cvpcb": {"equivalence_files": []},
        "libraries": {"pinned_footprint_libs": [], "pinned_symbol_libs": []},
        "meta": {"filename": NAME + ".kicad_pro", "version": 1},
        "net_settings": {
            "classes": classes,
            "meta": {"version": 3},
            "net_colors": None,
            "netclass_assignments": None,
            "netclass_patterns": patterns,
        },
        "pcbnew": {"last_paths": {}, "page_layout_descr_file": ""},
        "schematic": {
            "drawing": {"default_line_thickness": 6.0, "default_text_size": 50.0,
                        "label_size_ratio": 0.375, "pin_symbol_size": 25.0,
                        "text_offset_ratio": 0.15},
            "legacy_lib_dir": "", "legacy_lib_list": [],
            "meta": {"version": 1},
            "net_format_name": "", "page_layout_descr_file": "",
            "plot_directory": "", "spice_adjust_passive_values": False,
            "spice_external_command": "spice \"%I\"",
            "subpart_first_id": 65, "subpart_id_separator": 0,
        },
        "sheets": [], "text_variables": {},
    }
    with open(os.path.join(outdir, NAME + ".kicad_pro"), "w") as f:
        json.dump(pro, f, indent=2)
    with open(os.path.join(outdir, "fp-lib-table"), "w") as f:
        f.write('(fp_lib_table\n  (lib (name "AI_Glasses")(type "KiCad")'
                '(uri "${KIPRJMOD}/AI_Glasses.pretty")(options "")'
                '(descr "Project footprints"))\n)\n')
    with open(os.path.join(outdir, "sym-lib-table"), "w") as f:
        f.write('(sym_lib_table\n  (lib (name "AI_Glasses")(type "KiCad")'
                '(uri "${KIPRJMOD}/AI_Glasses.kicad_sym")(options "")'
                '(descr "Project symbols"))\n)\n')
