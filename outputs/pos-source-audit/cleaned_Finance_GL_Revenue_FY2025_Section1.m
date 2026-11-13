section Section1;

shared q_GL_Cleaning = let
    Source = Excel.Workbook(File.Contents("D:\DA\data 2\Finance_GL_Revenue_FY2025.xlsx"), null, true),
    GL_Revenue_Sheet = Source{[Item="GL_Revenue",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(GL_Revenue_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"journal_id", type text}, {"posting_date", type date}, {"period", type text}, {"account", type text}, {"journal_type", type text}, {"store_code", type text}, {"channel", type text}, {"currency", type text}, {"amount_local", type number}, {"fx_rate_month_end", type number}, {"amount_usd", type number}, {"description", type text}, {"source_ref", type text}}),
    #"Trimmed Text" = Table.TransformColumns(#"Changed Type",{{"journal_id", Text.Trim, type text}}),
    #"Cleaned Text" = Table.TransformColumns(#"Trimmed Text",{{"journal_id", Text.Clean, type text}}),
    #"Trimmed Text1" = Table.TransformColumns(#"Cleaned Text",{{"journal_type", Text.Trim, type text}}),
    #"Cleaned Text1" = Table.TransformColumns(#"Trimmed Text1",{{"journal_type", Text.Clean, type text}}),
    #"Trimmed Text2" = Table.TransformColumns(#"Cleaned Text1",{{"store_code", Text.Trim, type text}}),
    #"Cleaned Text2" = Table.TransformColumns(#"Trimmed Text2",{{"store_code", Text.Clean, type text}}),
    #"Trimmed Text3" = Table.TransformColumns(#"Cleaned Text2",{{"channel", Text.Trim, type text}}),
    #"Cleaned Text3" = Table.TransformColumns(#"Trimmed Text3",{{"channel", Text.Clean, type text}}),
    #"Trimmed Text4" = Table.TransformColumns(#"Cleaned Text3",{{"currency", Text.Trim, type text}}),
    #"Cleaned Text4" = Table.TransformColumns(#"Trimmed Text4",{{"currency", Text.Clean, type text}}),
    #"Trimmed Text5" = Table.TransformColumns(#"Cleaned Text4",{{"account", Text.Trim, type text}}),
    #"Cleaned Text5" = Table.TransformColumns(#"Trimmed Text5",{{"account", Text.Clean, type text}}),
    #"Added Custom" = Table.AddColumn(#"Cleaned Text5", "revenue_usd", each -[amount_usd]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Added Custom",{{"revenue_usd", type number}}),
    #"Added Custom1" = Table.AddColumn(#"Changed Type1", "revenue_local", each -[amount_local])
in
    #"Added Custom1";